import { invoke } from "@tauri-apps/api/core";
import type { RocketLogDownloader } from "../../../RocketLogDownloader/RocketLogDownloader";
import type { RocketStatusStore } from "../../../RocketStatus/RocketStatusStore";
import { FlightState } from "../../../RocketStatus/rocketTypes";

type SaveLog = (filename: string, bytes: Uint8Array) => Promise<string>;

export const IDLE_LOG_SETTLE_DELAY_MS = 500;

/** Allow firmware to finish closing the flight log after acknowledging END_FLIGHT. */
function waitForIdleLog(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, IDLE_LOG_SETTLE_DELAY_MS);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

/** Use the exact launch name; never save partial data or data from a replaced connection. */
export async function downloadFlightLog(
    filename: string,
    downloader: Pick<RocketLogDownloader, "startDownload">,
    store: Pick<RocketStatusStore, "getSession" | "getConnected" | "getSnapshot">,
    signal: AbortSignal,
    onSaving: () => void,
    save: SaveLog = (name, bytes) => invoke<string>("save_rocket_log", { filename: name, data: Array.from(bytes) }),
    setIdle?: () => Promise<void>,
): Promise<string> {
    signal.throwIfAborted();
    if (!filename.trim()) throw new Error("Flight name is unavailable. Select the log in Rocket Logs.");
    if (!store.getConnected()) throw new Error("Rocket is not connected");
    const state = store.getSnapshot("flightState").value;
    if (state !== FlightState.LANDED && state !== FlightState.IDLE && state !== FlightState.ABORTED) {
        throw new Error("Flight log downloads require landed or idle state");
    }
    const session = store.getSession();
    if (state === FlightState.ABORTED) {
        if (!setIdle) throw new Error("Set the aborted flight to idle before downloading its log");
        await setIdle();
        signal.throwIfAborted();
        await waitForIdleLog(signal);
        signal.throwIfAborted();
        if (session !== store.getSession() || !store.getConnected()) {
            throw new Error("Rocket connection changed while setting idle; download was not started");
        }
        // endFlight resolves on firmware acknowledgment; status readback may still show ABORTED.
        const current = store.getSnapshot("flightState").value;
        if (current !== FlightState.IDLE && current !== FlightState.ABORTED && current !== FlightState.LANDED) {
            throw new Error("Flight log downloads require landed or idle state");
        }
    }
    const bytes = await downloader.startDownload(filename);
    signal.throwIfAborted();
    if (session !== store.getSession() || !store.getConnected()) {
        throw new Error("Rocket connection changed during download; no file was saved");
    }
    onSaving();
    return save(filename, bytes);
}