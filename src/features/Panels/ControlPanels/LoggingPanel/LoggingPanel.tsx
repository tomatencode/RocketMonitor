import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketLogDownloader, useLogDownloadProgress } from "../../../RocketLogDownloader/RocketLogDownloaderContext";
import { useRocketConnected, useRocketStatus, useRocketStatusStore } from "../../../RocketStatus/RocketStatusContext";
import { FlightState } from "../../../RocketStatus/rocketTypes";
import { Card } from "../../../../shared/components/elements/Card";
import { DownloadIcon, LogFileIcon, RefreshIcon, TrashIcon } from "../../../../shared/components/elements/Icons";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { Button } from "../../../../shared/components/primitives/Button";
import { ProgressBar } from "../../../../shared/components/primitives/ProgressBar";
import { createLogFilename, listAllLogs, isLogDeleteConfirmed,
    type LogDeletion, type LogDeleteConfirmation } from "./logOperations";
import { scheduleFeedbackDismissal } from "./feedbackTimeout";

export interface LoggingPanelProps { className?: string }

export function LoggingPanel({ className = "" }: LoggingPanelProps) {
    const commander = useRocketCommander();
    const downloader = useRocketLogDownloader();
    const progress = useLogDownloadProgress();
    const store = useRocketStatusStore();
    const connected = useRocketConnected();
    const logging = useRocketStatus("logging");
    const { value: flightState } = useRocketStatus("flightState");
    const [logs, setLogs] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [listing, setListing] = useState(false);
    const [acting, setActing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<LogDeleteConfirmation | null>(null);
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
    const [savingFilename, setSavingFilename] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const [dismissedError, setDismissedError] = useState<string | null>(null);
    const listController = useRef<AbortController | null>(null);
    const saveController = useRef<AbortController | null>(null);
    const actionController = useRef<AbortController | null>(null);
    const mutationActive = useRef(false);
    const onGround = flightState === FlightState.IDLE || flightState === FlightState.LANDED || flightState === FlightState.ABORTED;
    const downloading = progress.running ? progress.filename : savingFilename;
    const busy = acting || deleting || progress.running || saving;
    const canDelete = connected && onGround && !busy && !listing;
    const canDeleteAll = canDelete && logging.hasValue && logging.value === false;
    const displayError = error ?? progress.error ?? logging.error;

    useEffect(() => {
        if (!deleteMessage) return;
        return scheduleFeedbackDismissal(() => setDeleteMessage(null));
    }, [deleteMessage]);

    useEffect(() => {
        if (!savedPath) return;
        return scheduleFeedbackDismissal(() => setSavedPath(null));
    }, [savedPath]);

    useEffect(() => {
        setDismissedError(null);
        if (!displayError) return;
        return scheduleFeedbackDismissal(() => setDismissedError(displayError));
    }, [displayError]);

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
        setSavingFilename(null);
        setSaving(false);
        setSavedPath(null);
        setError(null);
        setDismissedError(null);
        return () => {
            listController.current?.abort();
            saveController.current?.abort();
            actionController.current?.abort();
        };
    }, [connected, refreshLogs, downloader]);

    // Also load the list after a transfer that outlived a previous panel instance.
    useEffect(() => {
        if (connected && !progress.running) void refreshLogs();
    }, [connected, progress.running, refreshLogs]);

    // A confirmation must not survive a flight-state or recording-state change.
    useEffect(() => { setPendingDelete(null); }, [onGround, logging.value]);

    useEffect(() => {
        if (!pendingDelete) return;
        const timer = setTimeout(() => setPendingDelete(null), Math.max(0, pendingDelete.expiresAt - Date.now()));
        return () => clearTimeout(timer);
    }, [pendingDelete]);

    const toggleLogging = async () => {
        if (!connected || !onGround || busy || listing || mutationActive.current || downloader.isRunning() ||
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
            else await commander.startLog(createLogFilename(), Math.floor(Date.now() / 1000));
            if (!controller.signal.aborted) await refreshLogs();
        } catch (e) {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        } finally {
            mutationActive.current = false;
            if (!controller.signal.aborted) setActing(false);
        }
    };

    const handleDeleteClick = async (deletion: LogDeletion) => {
        if (!canDelete || mutationActive.current || downloader.isRunning() ||
            ("all" in deletion && !canDeleteAll)) return;
        if (!isLogDeleteConfirmed(pendingDelete, deletion)) {
            setPendingDelete({ deletion, expiresAt: Date.now() + 5000 });
            setError(null);
            return;
        }
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
        if (!connected || !onGround || busy || listing || downloader.isRunning() || mutationActive.current) return;
        const controller = new AbortController();
        saveController.current = controller;
        const session = store.getSession();
        setPendingDelete(null);
        setDeleteMessage(null);
        setSaving(false);
        setError(null);
        setSavedPath(null);
        try {
            const bytes = await downloader.startDownload(filename);
            if (session !== store.getSession()) return;
            if (!controller.signal.aborted) {
                setSavingFilename(filename);
                setSaving(true);
            }
            const path = await invoke<string>("save_rocket_log", { filename, data: Array.from(bytes) });
            if (!controller.signal.aborted) setSavedPath(path);
        } catch (e) {
            if (!controller.signal.aborted && !(e instanceof Error && e.name === "AbortError")) {
                setError(downloader.getProgress().error ?? (e instanceof Error ? e.message : String(e)));
            }
        } finally {
            if (!controller.signal.aborted && saveController.current === controller) {
                setSavingFilename(null);
                setSaving(false);
            }
        }
    };

    const recording = connected && logging.hasValue && logging.value === true;
    const label = !connected ? "Offline" : !logging.hasValue || logging.value === null ? "Unknown" : logging.value ? "Recording" : "Stopped";
    const downloadPercent = progress.total > 0 ? Math.min(100, Math.round(progress.received / progress.total * 100)) : null;
    return (
        <Card className={`min-w-0 p-3 flex flex-col gap-3 ${className}`}>
            <PanelHeader icon={<LogFileIcon aria-hidden="true" />} title="Rocket Logs" connected={connected} subtitle="onboard recording"
                end={<StatusPill tone={recording ? "ok" : "neutral"} pulse={recording}>{label}</StatusPill>} />

            <Button variant={logging.value ? "warning" : "success"}
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                disabled={!connected || !onGround || busy || listing || !logging.hasValue || logging.value === null}
                onClick={() => void toggleLogging()}>
                <span aria-hidden="true" className={`h-2 w-2 bg-current ${logging.value ? "rounded-sm" : "rounded-full"}`} />
                {acting ? "Sending..." : logging.value ? "Stop Logging" : "Start Logging"}
            </Button>
            {connected && !onGround && <Card variant="warning" className="px-2.5 py-2 text-[11px] leading-relaxed text-amber-300/80">Recording controls, downloads and deletion require ground state.</Card>}

            <section className="flex min-w-0 flex-col gap-2" aria-label="Saved logs">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Saved logs</span>
                        {loaded && <span className="rounded border border-zinc-700/60 bg-zinc-800/50 px-1.5 text-[10px] tabular-nums text-zinc-400">{logs.length}</span>}
                    </div>
                    <Button variant="ghost" className="flex items-center gap-1.5 px-2 py-1 text-[10px] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-zinc-400"
                        disabled={!connected || busy || listing} aria-label="Refresh rocket logs"
                        onClick={() => { store.refresh("logging"); void refreshLogs(); }}>
                        <RefreshIcon aria-hidden="true" className={`h-3 w-3 ${listing ? "animate-spin motion-reduce:animate-none" : ""}`} />
                        {listing ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5" aria-label="Rocket log files" aria-busy={listing}>
                    {(listing || !connected || logs.length === 0) && <Card variant="empty" className="flex flex-col items-center gap-1 px-3 py-2 text-center" role="status">
                        <LogFileIcon aria-hidden="true" className="h-4 w-4 text-zinc-600" />
                        <p className="text-[11px] font-medium text-zinc-400">
                            {!connected ? "Rocket offline" : listing ? "Loading logs..." : loaded ? "No completed logs yet" : "Waiting for log list"}
                        </p>
                        <p className="text-[10px] leading-relaxed text-zinc-500">
                            {!connected ? "Connect to the rocket to load logs."
                                : listing ? "Reading the onboard file list."
                                : recording ? "Stop recording to make the current log downloadable."
                                : "Completed recordings will appear here."}
                        </p>
                    </Card>}
                    {logs.map(filename => {
                        const confirming = isLogDeleteConfirmed(pendingDelete, { filename });
                        const transferring = downloading === filename;
                        return (
                            <Card key={filename} variant={confirming ? "warning" : transferring ? "info" : "inner"}
                                className="flex items-center gap-2 px-2.5 py-2">
                                <LogFileIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-[11px] font-medium text-zinc-200" title={filename}>{filename}</span>
                                    <span className={`text-[10px] ${confirming ? "text-amber-300" : transferring ? "text-sky-300" : "text-zinc-500"}`}>
                                        {confirming ? "Confirm within 5 seconds" : transferring ? saving ? "Saving..." : "Downloading..." : ".rcktlog"}
                                    </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <Button variant="ghost" className="p-2 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-zinc-400"
                                        disabled={!connected || !onGround || busy || listing} title={`Download ${filename} as .rcktlog`}
                                        aria-label={`Download ${filename} as .rcktlog`} onClick={() => void handleDownload(filename)}>
                                        <DownloadIcon aria-hidden="true" className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant={confirming ? "warning" : "ghost"}
                                        className={`p-2 text-[10px] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-zinc-400 ${confirming ? "" : "hover:text-red-300 hover:border-red-800/60"}`}
                                        disabled={!canDelete}
                                        title={confirming
                                            ? `Click again within five seconds to permanently delete ${filename} from the rocket`
                                            : `Delete ${filename} from the rocket; does not reclaim flash space or delete local downloads`}
                                        aria-label={confirming ? `Confirm deletion of ${filename} from rocket` : `Delete ${filename} from rocket`}
                                        onClick={() => void handleDeleteClick({ filename })}>
                                        {confirming ? "Confirm?" : <TrashIcon aria-hidden="true" className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </section>

            {downloading !== null && <Card variant="info" className="flex flex-col gap-2 p-2.5" aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-sky-300">{saving ? "Saving file" : "Log transfer"}</span>
                    <span className="text-[10px] tabular-nums text-sky-300">{saving ? "100%" : downloadPercent === null ? "Preparing..." : `${downloadPercent}%`}</span>
                </div>
                <span className="text-[11px] text-zinc-300 break-all">{saving ? "Saving " : "Downloading "}{downloading}:</span>
                <ProgressBar value={saving && progress.total === 0 ? 1 : progress.total > 0 ? progress.received : undefined}
                    max={progress.total || 1} tone={saving ? "ok" : "info"} aria-label="Log download progress" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] tabular-nums text-zinc-500">{progress.received} / {progress.total} bytes</span>
                    <Button variant="ghost" className="px-2 py-1 text-[10px] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-zinc-400"
                        disabled={saving || progress.state === "stopping"} onClick={downloader.stopDownload}>
                        {progress.state === "stopping" ? "Cancelling..." : "Cancel Download"}
                    </Button>
                </div>
            </Card>}
            {deleteMessage && <Card variant="success" className="px-2.5 py-2 text-[11px] text-emerald-300 break-all" role="status">{deleteMessage}</Card>}
            {savedPath && <Card variant="success" className="px-2.5 py-2" role="status">
                <p className="text-[11px] font-medium text-emerald-300">Log saved</p>
                <p className="mt-1 text-[10px] leading-relaxed text-emerald-300/70 break-all">Saved: {savedPath}</p>
            </Card>}
            {displayError && displayError !== dismissedError && <Card variant="error" className="px-2.5 py-2 text-[11px] text-red-300 break-all" role="alert">{displayError}</Card>}
            <p className="border-t border-zinc-800/80 pt-2 text-[10px] leading-relaxed text-zinc-500">Downloads are saved as raw <span className="text-zinc-400">.rcktlog</span> files in your Downloads folder.</p>
        </Card>
    );
}