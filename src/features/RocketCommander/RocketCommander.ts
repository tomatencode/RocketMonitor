import type { RocketCommands, FlightProfile, Quaternion, LogMetadata, RocketLogReader, DownloadTrafficControl } from "../RocketStatus/rocketTypes";
import { RocketStatusStore, type RocketStatusTopic } from "../RocketStatus/RocketStatusStore";

/** All rocket mutations pass here; consumers never need a transport reference. */
export class RocketCommander implements RocketCommands, RocketLogReader {
    private download: AbortController | null = null;
    private activeRequests = new Set<Promise<unknown>>();

    constructor(
        private readonly getCommands: () => RocketCommands,
        private readonly status: RocketStatusStore,
        private readonly getLogReader?: () => RocketLogReader,
        private readonly traffic?: DownloadTrafficControl,
    ) {}

    private run(command: (commands: RocketCommands) => Promise<void>, topics: RocketStatusTopic[] = [], emergency = false) {
        const session = this.status.getSession();
        // Do not queue all mutations: an abort must not wait behind a slow unrelated action.
        return this.track(async () => {
            if (emergency) this.download?.abort();
            else this.ensureNotDownloading();
            if (!this.status.getConnected() || session !== this.status.getSession()) {
                throw new Error("Rocket is not connected or the connection has changed");
            }
            await command(this.getCommands());
            if (session !== this.status.getSession()) {
                throw new Error("Rocket connection changed while the command was running; outcome unknown");
            }
            // Command success and readback success are separate. Readback errors live in status;
            // never report a successful action as failed and encourage an unsafe retry.
            this.status.refresh(...topics);
        });
    }

    setGimbalPos = (degX: number, degY: number) => this.run(c => c.setGimbalPos(degX, degY), ["gimbal"]);
    beepBuzzer = () => this.run(c => c.beepBuzzer());
    firePyroChanel = (channel: number, durationMs?: number) =>
        this.run(c => c.firePyroChanel(channel, durationMs), [`pyroContinuity:${channel}`]);
    setPyroSoftwareArmed = (armed: boolean) =>
        this.run(c => c.setPyroSoftwareArmed(armed), ["pyroSoftwareArmed"]);
    setRotation = (quaternion: Quaternion) => this.run(c => c.setRotation(quaternion), ["rotation"]);
    setAccumulatingRotation = (accumulating: boolean) =>
        this.run(c => c.setAccumulatingRotation(accumulating), ["rotation"]);
    abortFlight = () => this.run(c => c.abortFlight(), this.flightTopics(), true);
    endFlight = () => this.run(c => c.endFlight(), this.flightTopics());
    calibrateBaroHeight = (height_m: number) =>
        this.run(c => c.calibrateBaroHeight(height_m), ["baroHeight", "flightLocation"]);
    flashLed = (durationMs?: number) => this.run(c => c.flashLed(durationMs));
    startCountdown = (profile: FlightProfile) => this.run(c => c.startCountdown(profile), [
        ...this.flightTopics(), "rotation", "baroHeight", "pidParameters", "pidTarget",
        "pyroSoftwareArmed",
    ]);
    retryDeployParachute = () => this.run(c => c.retryDeployParachute(), this.flightTopics());
    setPIDParameters = (kp: number, ki: number, kd: number) =>
        this.run(c => c.setPIDParameters(kp, ki, kd), ["pidParameters"]);
    setControlling = (controlling: boolean) => this.run(c => c.setControlling(controlling), ["controlling", "gimbal"]);
    setPIDTarget = (target: Quaternion) => this.run(c => c.setPIDTarget(target), ["pidTarget"]);
    startLog = (filename: string, metadata: LogMetadata) =>
        this.run(c => c.startLog(filename, metadata), ["logging"]);
    finishLog = () => this.run(c => c.finishLog(), ["logging"]);
    deleteLog = (filename: string) => this.run(c => c.deleteLog(filename));
    deleteAllLogs = () => this.run(c => c.deleteAllLogs(), ["logging"]);

    /** Log file reads are explicit operations, not status polls. Request chunks sequentially. */
    listLogs = (startIndex?: number) => this.readLog(reader => reader.listLogs(startIndex));
    getLogInfo = (filename: string) => this.readLog(reader => reader.getLogInfo(filename));
    getLogBytes = (filename: string, offset: number, length: number) =>
        this.readLog(reader => reader.getLogBytes(filename, offset, length));

    private readLog<T>(read: (reader: RocketLogReader) => Promise<T>): Promise<T> {
        return this.track(async () => {
            this.ensureNotDownloading();
            return this.readLogDirect(read);
        });
    }

    private async readLogDirect<T>(read: (reader: RocketLogReader) => Promise<T>): Promise<T> {
        const session = this.status.getSession();
        if (!this.status.getConnected()) throw new Error("Rocket is not connected");
        if (!this.getLogReader) throw new Error("Rocket log reader is not configured");
        const value = await read(this.getLogReader());
        if (session !== this.status.getSession()) throw new Error("Rocket connection changed while reading log");
        return value;
    }

    private ensureNotDownloading() {
        if (this.download) throw new Error("Rocket commands are paused during a log download");
    }

    private track<T>(operation: () => Promise<T>): Promise<T> {
        const result = operation();
        this.activeRequests.add(result);
        void result.then(() => this.activeRequests.delete(result), () => this.activeRequests.delete(result));
        return result;
    }

    /** Scoped download reader is the only commander API allowed to read during exclusivity. */
    async withLogDownload<T>(operation: (reader: RocketLogReader) => Promise<T>, signal?: AbortSignal): Promise<T> {
        this.ensureNotDownloading();
        signal?.throwIfAborted();
        if (!this.status.getConnected()) throw new Error("Rocket is not connected");
        const session = this.status.getSession();
        const controller = new AbortController();
        this.download = controller;
        const cancel = () => controller.abort();
        signal?.addEventListener("abort", cancel, { once: true });
        const polling = this.status.pausePolling();
        let traffic: ReturnType<DownloadTrafficControl["acquireDownload"]> | undefined;
        const outstanding = new Set<Promise<unknown>>();
        let open = true;
        const read = <R,>(fn: (reader: RocketLogReader) => Promise<R>): Promise<R> => {
            const result = (async () => {
                if (!open) throw new Error("Download reader has expired");
                controller.signal.throwIfAborted();
                if (session !== this.status.getSession()) throw new Error("Rocket connection changed during download");
                const value = await this.readLogDirect(fn);
                controller.signal.throwIfAborted();
                return value;
            })();
            outstanding.add(result);
            void result.then(() => outstanding.delete(result), () => outstanding.delete(result));
            return result;
        };
        try {
            traffic = this.traffic?.acquireDownload();
            await Promise.all([polling.ready, traffic?.ready, Promise.allSettled([...this.activeRequests])]);
            controller.signal.throwIfAborted();
            if (session !== this.status.getSession()) throw new Error("Rocket connection changed during download");
            const result = await operation({
                listLogs: async () => { throw new Error("Log listing is paused during download"); },
                getLogInfo: filename => read(reader => reader.getLogInfo(filename)),
                getLogBytes: (filename, offset, length) => read(reader => reader.getLogBytes(filename, offset, length)),
            });
            controller.signal.throwIfAborted();
            if (session !== this.status.getSession()) throw new Error("Rocket connection changed during download");
            return result;
        } finally {
            open = false;
            await Promise.allSettled([...outstanding]);
            signal?.removeEventListener("abort", cancel);
            traffic?.release();
            this.download = null;
            polling.release();
        }
    }

    private flightTopics(): RocketStatusTopic[] {
        return ["flightState", "countdownTime", "flightLocation", "controlling"];
    }
}