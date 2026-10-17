import { FlightState } from "../../../RocketStatus/rocketTypes";
import { Card } from "../../../../shared/components/elements/Card";
import { Button } from "../../../../shared/components/primitives/Button";
import { FlightTelemetry } from "./FlightTelemetry";
import type { FlightLocationData } from "../../../RocketStatus/rocketTypes";
import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "../../../../shared/components/elements/Icons";
import { ProgressBar } from "../../../../shared/components/primitives/ProgressBar";
import { useLogDownloadProgress, useRocketLogDownloader } from "../../../RocketLogDownloader/RocketLogDownloaderContext";
import { useRocketConnected, useRocketStatusStore } from "../../../RocketStatus/RocketStatusContext";
import { downloadFlightLog } from "./downloadFlightLog";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";

interface FlightSummaryProps {
    state: FlightState;
    flightName: string | null;
    location: FlightLocationData | null;
    maxAltitude_m: number | null;
    maxVelocity_m_s: number | null;
    elapsedMs: number | null;
    ending: boolean;
    onSetIdle: () => Promise<void>;
    onPrepareIdleDownload: () => void;
    onIdleDownloadReady: (session: number) => void;
}

export function FlightSummary({ state, flightName, location, maxAltitude_m, maxVelocity_m_s, elapsedMs, ending, onSetIdle, onPrepareIdleDownload, onIdleDownloadReady }: FlightSummaryProps) {
    const aborted = state === FlightState.ABORTED;
    const connected = useRocketConnected();
    const store = useRocketStatusStore();
    const downloader = useRocketLogDownloader();
    const { endFlight, setDoLocatingSound } = useRocketCommander();
    const progress = useLogDownloadProgress();
    const [downloading, setDownloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [stoppingLocatingSound, setStoppingLocatingSound] = useState(false);
    // Firmware only plays the locating melody while LANDED and has no setting getter.
    const [locatingSoundStopped, setLocatingSoundStopped] = useState(false);
    const locatingSoundOn = state === FlightState.LANDED && !locatingSoundStopped;
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const operation = useRef<AbortController | null>(null);

    useEffect(() => {
        setDownloading(false);
        setSaving(false);
        setPreparing(false);
        setStoppingLocatingSound(false);
        setLocatingSoundStopped(false);
        setSavedPath(null);
        setError(null);
        return () => {
            operation.current?.abort();
            operation.current = null;
        };
    }, [connected, flightName, store]);

    const handleStopLocatingSound = async () => {
        if (!connected || !locatingSoundOn || ending || operation.current || downloader.isRunning()) return;
        const controller = new AbortController();
        operation.current = controller;
        setStoppingLocatingSound(true);
        setError(null);
        try {
            await setDoLocatingSound(false);
            if (!controller.signal.aborted) setLocatingSoundStopped(true);
        } catch (e) {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (operation.current === controller) {
                operation.current = null;
                setStoppingLocatingSound(false);
            }
        }
    };

    const handleDownload = async () => {
        if (!connected || !flightName || ending || operation.current || downloader.isRunning()) return;
        const controller = new AbortController();
        operation.current = controller;
        setDownloading(true);
        setError(null);
        setSavedPath(null);
        try {
            const path = await downloadFlightLog(flightName, downloader, store, controller.signal, () => setSaving(true), undefined, async () => {
                onPrepareIdleDownload();
                setPreparing(true);
                const session = store.getSession();
                try {
                    await endFlight();
                    if (!controller.signal.aborted && session === store.getSession()) onIdleDownloadReady(session);
                } finally {
                    if (!controller.signal.aborted) setPreparing(false);
                }
            });
            if (!controller.signal.aborted) setSavedPath(path);
        } catch (e) {
            if (!controller.signal.aborted && !(e instanceof Error && e.name === "AbortError")) {
                setError(e instanceof Error ? e.message : String(e));
            }
        } finally {
            if (operation.current === controller) {
                operation.current = null;
                setDownloading(false);
                setSaving(false);
            }
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <Card variant={aborted ? "error" : "success"} className="flex flex-col gap-1 p-3" role="status">
                <p className={`text-xs font-semibold ${aborted ? "text-red-300" : "text-emerald-300"}`}>
                    {aborted ? "Flight aborted" : "Flight complete"}
                </p>
                {aborted && <p className="text-[10px] leading-relaxed text-zinc-500">Downloading will set the controller to idle first.</p>}
                <p className="text-[11px] leading-relaxed text-zinc-400">Review the flight readings below. Set idle to return to flight setup.</p>
            </Card>
            <FlightTelemetry location={location} maxAltitude_m={maxAltitude_m} maxVelocity_m_s={maxVelocity_m_s} elapsedMs={elapsedMs} countdownTime_ms={null} />
            <Card variant="inner" className="flex min-w-0 flex-col gap-2 p-3">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">Flight log</span>
                <p className="text-[11px] leading-relaxed text-zinc-500 break-all">
                    {flightName ? `${flightName} · saves to Downloads as .rcktlog` : "Flight name unavailable. Select the corresponding log in Rocket Logs."}
                </p>
                <Button variant="primary" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                    disabled={!connected || !flightName || ending || stoppingLocatingSound || downloading || progress.running}
                    onClick={() => void handleDownload()}>
                    <DownloadIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    {preparing ? "Setting idle before download..." : saving ? "Saving Flight Log..." : downloading ? "Downloading Flight Log..." : "Download Flight Log"}
                </Button>
                {downloading && <div className="flex flex-col gap-2" aria-live="polite">
                    <ProgressBar value={saving ? 1 : progress.total > 0 ? progress.received : undefined} max={saving ? 1 : progress.total || 1} tone="info" aria-label="Flight log download progress" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] tabular-nums text-zinc-500">{preparing ? "Waiting for idle acknowledgment..." : saving ? "Saving to Downloads..." : `${progress.received} / ${progress.total} bytes`}</span>
                        {!saving && !preparing && <Button variant="neutral" className="px-2 py-1 text-[10px] focus-visible:outline-2 focus-visible:outline-zinc-400" disabled={progress.state === "stopping"} onClick={downloader.stopDownload}>
                            {progress.state === "stopping" ? "Cancelling..." : "Cancel Download"}
                        </Button>}
                    </div>
                </div>}
                {savedPath && <Card variant="success" className="px-2.5 py-2 text-[11px] text-emerald-300 break-all" role="status">Saved: {savedPath}</Card>}
                {error && <Card variant="error" className="px-2.5 py-2 text-[11px] text-red-300 break-all" role="alert">{error}</Card>}
            </Card>
            {locatingSoundOn && (
                <Button variant="neutral" className="w-full px-3 py-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" disabled={!connected || ending || stoppingLocatingSound || downloading || progress.running} onClick={() => void handleStopLocatingSound()}>
                    {stoppingLocatingSound ? "Stopping..." : "Stop Locating Sound"}
                </Button>
            )}
            <Button variant="neutral" className="w-full px-3 py-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" disabled={!connected || ending || stoppingLocatingSound || downloading || progress.running} onClick={() => void onSetIdle()}>
                {ending ? "Setting idle..." : "Set Idle"}
            </Button>
        </div>
    );
}
