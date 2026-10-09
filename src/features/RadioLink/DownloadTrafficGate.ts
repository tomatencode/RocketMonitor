import { MessageType } from "./Protocol";

/** Blocks new competing traffic and drains existing requests before a download. */
export class DownloadTrafficGate {
    private downloading = false;
    private active = new Set<Promise<unknown>>();

    isDownloading = () => this.downloading;

    async request<T>(type: MessageType, send: () => Promise<T>): Promise<T> {
        if (this.downloading && type !== MessageType.GET_LOG_INFO &&
            type !== MessageType.GET_LOG_BYTES && type !== MessageType.ABORT_FLIGHT) {
            throw new Error("Radio requests are paused during a log download");
        }
        const result = send();
        this.active.add(result);
        try { return await result; }
        finally { this.active.delete(result); }
    }

    acquireDownload() {
        if (this.downloading) throw new Error("A log download is already running");
        this.downloading = true;
        let released = false;
        return {
            ready: Promise.allSettled([...this.active]).then(() => {}),
            release: () => {
                if (released) return;
                released = true;
                this.downloading = false;
            },
        };
    }
}