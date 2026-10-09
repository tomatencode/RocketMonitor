import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketConnected, useRocketStatus, useRocketStatusStore } from "../../../RocketStatus/RocketStatusContext";
import { FlightState } from "../../../RocketStatus/rocketTypes";
import { Card } from "../../../../shared/components/elements/Card";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { Button } from "../../../../shared/components/primitives/Button";
import { createLogFilename, createLogMetadata, downloadLog, listAllLogs } from "./logOperations";
import { DeleteLogConfirmation, type LogDeletion } from "./DeleteLogConfirmation";

export interface LoggingPanelProps { className?: string }

export function LoggingPanel({ className = "" }: LoggingPanelProps) {
    const commander = useRocketCommander();
    const store = useRocketStatusStore();
    const connected = useRocketConnected();
    const logging = useRocketStatus("logging");
    const { value: flightState } = useRocketStatus("flightState");
    const { value: rotation } = useRocketStatus("rotation");
    const { value: target } = useRocketStatus("pidTarget");
    const { value: parameters } = useRocketStatus("pidParameters");
    const { value: height } = useRocketStatus("baroHeight");
    const [logs, setLogs] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [listing, setListing] = useState(false);
    const [acting, setActing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<LogDeletion | null>(null);
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState({ received: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const listController = useRef<AbortController | null>(null);
    const downloadController = useRef<AbortController | null>(null);
    const actionController = useRef<AbortController | null>(null);
    const downloadActive = useRef(false);
    const mutationActive = useRef(false);
    const onGround = flightState === FlightState.IDLE || flightState === FlightState.LANDED || flightState === FlightState.ABORTED;
    const busy = acting || deleting || downloading !== null;
    const canDelete = connected && onGround && !busy && !listing;
    const canDeleteAll = canDelete && logging.hasValue && logging.value === false;

    const refreshLogs = useCallback(async () => {
        setPendingDelete(null);
        listController.current?.abort();
        const controller = new AbortController();
        listController.current = controller;
        setListing(true);
        setError(null);
        try {
            const filenames = await listAllLogs(commander, controller.signal);
            setLogs(filenames);
            setLoaded(true);
        } catch (e) {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (!controller.signal.aborted) setListing(false);
        }
    }, [commander]);

    useEffect(() => {
        setLogs([]);
        setLoaded(false);
        setListing(false);
        setActing(false);
        setDeleting(false);
        setPendingDelete(null);
        setDeleteMessage(null);
        setDownloading(null);
        setSaving(false);
        setSavedPath(null);
        setError(null);
        if (connected) void refreshLogs();
        return () => {
            listController.current?.abort();
            downloadController.current?.abort();
            downloadController.current = null;
            actionController.current?.abort();
        };
    }, [connected, refreshLogs]);

    // A confirmation must not survive a flight-state or recording-state change.
    useEffect(() => { setPendingDelete(null); }, [onGround, logging.value]);

    const toggleLogging = async () => {
        if (!connected || !onGround || busy || listing || mutationActive.current || downloadActive.current ||
            !logging.hasValue || logging.value === null) return;
        const controller = new AbortController();
        actionController.current = controller;
        mutationActive.current = true;
        setPendingDelete(null);
        setDeleteMessage(null);
        setActing(true);
        setError(null);
        try {
            if (logging.value) await commander.finishLog();
            else await commander.startLog(createLogFilename(), createLogMetadata(rotation, target, parameters, height));
            if (!controller.signal.aborted) await refreshLogs();
        } catch (e) {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        } finally {
            mutationActive.current = false;
            if (!controller.signal.aborted) setActing(false);
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete || !canDelete || mutationActive.current || downloadActive.current ||
            ("all" in pendingDelete && !canDeleteAll)) return;
        const deletion = pendingDelete;
        const controller = new AbortController();
        actionController.current = controller;
        mutationActive.current = true;
        setPendingDelete(null);
        setDeleting(true);
        setError(null);
        setDeleteMessage(null);
        try {
            if ("all" in deletion) await commander.deleteAllLogs();
            else await commander.deleteLog(deletion.filename);
            if (!controller.signal.aborted) {
                // Reflect acknowledged deletion even if the following list refresh fails.
                setLogs(current => "all" in deletion ? [] : current.filter(name => name !== deletion.filename));
                setDeleteMessage("all" in deletion ? "All rocket logs deleted." : `Deleted ${deletion.filename} from the rocket.`);
                await refreshLogs();
            }
        } catch (e) {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        } finally {
            mutationActive.current = false;
            if (!controller.signal.aborted) setDeleting(false);
        }
    };

    const handleDownload = async (filename: string) => {
        if (!connected || !onGround || busy || listing || downloadActive.current || mutationActive.current) return;
        const controller = new AbortController();
        downloadController.current = controller;
        downloadActive.current = true;
        setPendingDelete(null);
        setDeleteMessage(null);
        setDownloading(filename);
        setSaving(false);
        setProgress({ received: 0, total: 0 });
        setError(null);
        setSavedPath(null);
        try {
            const bytes = await commander.withLogDownload(reader => downloadLog(reader, filename, controller.signal,
                (received, total) => setProgress({ received, total })), controller.signal);
            controller.signal.throwIfAborted();
            setSaving(true);
            const path = await invoke<string>("save_rocket_log", { filename, data: Array.from(bytes) });
            if (!controller.signal.aborted) setSavedPath(path);
        } catch (e) {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        } finally {
            downloadActive.current = false;
            if (downloadController.current === controller) {
                setDownloading(null);
                setSaving(false);
            }
        }
    };

    const cancelDownload = () => {
        downloadController.current?.abort();
    };
    const label = !connected ? "Offline" : !logging.hasValue ? "Unknown" : logging.value ? "Recording" : "Stopped";
    const displayError = error ?? logging.error;
    return (
        <Card className={`p-3 flex flex-col gap-3 ${className}`}>
            <PanelHeader icon="L" title="Rocket Logs" connected={connected} subtitle="onboard recording"
                end={<StatusPill tone={connected && logging.value === true ? "ok" : "neutral"}
                    pulse={connected && logging.value === true}>{label}</StatusPill>} />
            <Button variant={logging.value ? "warning" : "success"} className="px-3 py-2 text-xs"
                disabled={!connected || !onGround || busy || listing || !logging.hasValue || logging.value === null}
                onClick={() => void toggleLogging()}>
                {acting ? "Sending..." : logging.value ? "Stop Logging" : "Start Logging"}
            </Button>
            <p className="text-[10px] text-zinc-500">
                Timestamped name; metadata uses current status. Missing attitude, gains or height use identity/zero defaults.
            </p>
            {connected && !onGround && <p className="text-[11px] text-zinc-500">Recording controls, downloads and deletion require ground state.</p>}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Saved logs {loaded ? `(${logs.length})` : ""}</span>
                <Button variant="ghost" className="px-2 py-1 text-[10px]" disabled={!connected || busy || listing}
                    onClick={() => { store.refresh("logging"); void refreshLogs(); }}>Refresh</Button>
            </div>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5" aria-label="Rocket log files">
                {listing && <p className="text-[11px] text-zinc-500">Loading logs...</p>}
                {!listing && connected && loaded && logs.length === 0 && <p className="text-[11px] text-zinc-500">No completed logs yet. Stop recording to make the current log downloadable.</p>}
                {!connected && <p className="text-[11px] text-zinc-500">Connect to the rocket to load logs.</p>}
                {logs.map(filename => <div key={filename} className="flex items-stretch gap-1.5">
                    <Button variant="neutral" className="min-w-0 flex-1 px-2.5 py-2 text-xs text-left break-all"
                        disabled={!connected || !onGround || busy || listing} title={`Download ${filename} as .rcktlog`}
                        onClick={() => void handleDownload(filename)}>{filename} <span className="text-zinc-500">↓</span></Button>
                    <Button variant="danger" className="shrink-0 px-2 py-1.5 text-[10px]" disabled={!canDelete}
                        aria-label={`Delete ${filename} from rocket`} onClick={() => setPendingDelete({ filename })}>Delete</Button>
                </div>)}
            </div>
            {pendingDelete && <DeleteLogConfirmation deletion={pendingDelete}
                disabled={"all" in pendingDelete ? !canDeleteAll : !canDelete}
                onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)} />}
            {deleteMessage && <p className="text-[11px] text-emerald-300 break-all" role="status">{deleteMessage}</p>}
            {downloading !== null && <div className="flex flex-col gap-1.5" aria-live="polite">
                {!saving && <span className="text-[10px] text-amber-300">Telemetry paused; downloading in batched frames.</span>}
                <span className="text-[11px] text-zinc-400 break-all">{saving ? "Saving " : "Downloading "}{downloading}: {progress.received} / {progress.total} bytes</span>
                <progress className="w-full h-1.5" value={progress.received} max={progress.total || 1} aria-label="Log download progress" />
                <Button variant="ghost" className="px-2 py-1 text-xs" disabled={saving} onClick={cancelDownload}>Cancel Download</Button>
            </div>}
            {savedPath && <p className="text-[11px] text-emerald-300 break-all" role="status">Saved: {savedPath}</p>}
            <p className="text-[10px] text-zinc-500">Downloads are saved as raw .rcktlog files in your Downloads folder.</p>
            {displayError && <p className="text-[11px] text-red-300 break-all" role="alert">{displayError}</p>}
        </Card>
    );
}