import type { RocketCommands, FlightProfile, Quaternion, LogMetadata, RocketLogReader } from "../RocketStatus/rocketTypes";
import { RocketStatusStore, type RocketStatusTopic } from "../RocketStatus/RocketStatusStore";

/** All rocket mutations pass here; consumers never need a transport reference. */
export class RocketCommander implements RocketCommands, RocketLogReader {
    constructor(
        private readonly getCommands: () => RocketCommands,
        private readonly status: RocketStatusStore,
        private readonly getLogReader?: () => RocketLogReader,
    ) {}

    private run(command: (commands: RocketCommands) => Promise<void>, topics: RocketStatusTopic[] = []) {
        const session = this.status.getSession();
        // Do not queue all mutations: an abort must not wait behind a slow unrelated action.
        return (async () => {
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
        })();
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
    abortFlight = () => this.run(c => c.abortFlight(), this.flightTopics());
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

    /** Log file reads are explicit operations, not status polls. Request chunks sequentially. */
    listLogs = (startIndex?: number) => this.readLog(reader => reader.listLogs(startIndex));
    getLogInfo = (filename: string) => this.readLog(reader => reader.getLogInfo(filename));
    getLogBytes = (filename: string, offset: number, length: number) =>
        this.readLog(reader => reader.getLogBytes(filename, offset, length));

    private async readLog<T>(read: (reader: RocketLogReader) => Promise<T>): Promise<T> {
        const session = this.status.getSession();
        if (!this.status.getConnected()) throw new Error("Rocket is not connected");
        if (!this.getLogReader) throw new Error("Rocket log reader is not configured");
        const value = await read(this.getLogReader());
        if (session !== this.status.getSession()) throw new Error("Rocket connection changed while reading log");
        return value;
    }

    private flightTopics(): RocketStatusTopic[] {
        return ["flightState", "countdownTime", "flightLocation", "controlling"];
    }
}