import type { DownloadTrafficControl, RocketLogReader } from "../RocketStatus/rocketTypes";
import { RocketStatusStore } from "../RocketStatus/RocketStatusStore";
import { downloadLog } from "./downloadLog";

/** Minimal command interlock; Commander does not own the download protocol. */
export interface LogDownloadControl {
    isRunning: () => boolean;
    stopDownload: () => void;
}

export interface LogDownloadProgress {
    readonly filename: string | null;
    readonly running: boolean;
    readonly received: number;
    readonly total: number;
    readonly state: "idle" | "downloading" | "stopping" | "completed" | "cancelled" | "failed";
    readonly error: string | null;
}

/** Owns transfer lifetime, exclusivity and protocol independently of React panels. */
export class RocketLogDownloader implements LogDownloadControl {
    private controller: AbortController | null = null;
    private listeners = new Set<() => void>();
    private progress: LogDownloadProgress = {
        filename: null, running: false, received: 0, total: 0, state: "idle", error: null,
    };

    constructor(
        private readonly getReader: () => RocketLogReader,
        private readonly status: RocketStatusStore,
        private readonly traffic: DownloadTrafficControl,
        private readonly waitForCommands: () => Promise<void>,
    ) {}

    isRunning = () => this.controller !== null;
    getProgress = () => this.progress;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    /** Remains running while already-sent requests drain. Safe to call when idle. */
    stopDownload = () => {
        if (!this.controller || this.controller.signal.aborted) return;
        this.controller.abort();
        this.update({ state: "stopping" });
    };

    /** Returns verified raw bytes; local file saving is deliberately outside the service. */
    startDownload = async (filename: string): Promise<Uint8Array> => {
        if (this.isRunning()) throw new Error("A log download is already running");
        if (!this.status.getConnected()) throw new Error("Rocket is not connected");
        const session = this.status.getSession();
        const controller = new AbortController();
        this.controller = controller;
        const unsubscribe = this.status.subscribeConnection(() => {
            if (session !== this.status.getSession() || !this.status.getConnected()) this.stopDownload();
        });
        let polling: ReturnType<RocketStatusStore["pausePolling"]> | undefined;
        let traffic: ReturnType<DownloadTrafficControl["acquireDownload"]> | undefined;
        let state: LogDownloadProgress["state"] = "completed";
        let error: string | null = null;
        const check = () => {
            if (session !== this.status.getSession()) throw new Error("Rocket connection changed during download");
            controller.signal.throwIfAborted();
        };
        try {
            polling = this.status.pausePolling();
            traffic = this.traffic.acquireDownload();
            this.update({ filename, running: true, received: 0, total: 0, state: "downloading", error: null });
            await Promise.all([polling.ready, traffic.ready, this.waitForCommands()]);
            check();
            const reader = this.getReader();
            const bytes = await downloadLog({
                listLogs: async () => { throw new Error("Log listing is paused during download"); },
                getLogInfo: async name => {
                    check();
                    const value = await reader.getLogInfo(name);
                    check();
                    return value;
                },
                getLogBytes: async (name, offset, length) => {
                    check();
                    const value = await reader.getLogBytes(name, offset, length);
                    check();
                    return value;
                },
            }, filename, controller.signal, (received, total) => this.update({ received, total }));
            check();
            return bytes;
        } catch (e) {
            state = controller.signal.aborted ? "cancelled" : "failed";
            error = state === "failed" ? (e instanceof Error ? e.message : String(e)) : null;
            throw e;
        } finally {
            unsubscribe();
            traffic?.release();
            this.controller = null;
            polling?.release();
            this.update({ running: false, state, error });
        }
    };

    private update(change: Partial<LogDownloadProgress>) {
        this.progress = { ...this.progress, ...change };
        this.listeners.forEach(listener => listener());
    }
}