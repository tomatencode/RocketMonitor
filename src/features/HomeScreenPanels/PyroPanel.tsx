import { useEffect, useRef, useState } from "react";
import { useRadioLink } from "../RadioLink/RadioLinkContext";
import { Button } from "../../shared/components/primitives/Button";
import { Card } from "../../shared/components/primitives/Card";
import { Input } from "../../shared/components/primitives/Input";
import { usePyroStatus } from "./usePyroStatus";

export interface PyroPanelProps {
    channels?: number[];
    channelLabels?: string[];
    pollIntervalMs?: number;
    /** Default fire pulse length in ms applied to every channel input. */
    defaultFireDurationMs?: number;
    className?: string;
}

const DEFAULT_CHANNELS = [0, 1, 2];

type ArmState = boolean | null;

function StatusDot({ state, activeColor }: { state: ArmState; activeColor: string }) {
    if (state === null) {
        return <span className="inline-block h-2 w-2 rounded-full bg-zinc-600" />;
    }
    return (
        <span className="relative flex h-2 w-2">
            {state && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${activeColor}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${state ? activeColor : "bg-emerald-500"}`} />
        </span>
    );
}

function armLabel(state: ArmState, armedText: string): string {
    if (state === null) return "--";
    return state ? armedText : "SAFE";
}

export function PyroPanel({
    channels = DEFAULT_CHANNELS,
    channelLabels,
    pollIntervalMs = 1500,
    defaultFireDurationMs = 200,
    className = "",
}: PyroPanelProps) {
    const { connected, firePyroChanel, setPyroSoftwareArmed } = useRadioLink();
    const { hardwareArmed, softwareArmed, continuity, isLoading, error: pollError, lastUpdatedAt, refresh } =
        usePyroStatus({ channels, pollIntervalMs, enabled: connected });

    const [firingChannel, setFiringChannel] = useState<number | null>(null);
    const [confirmChannel, setConfirmChannel] = useState<number | null>(null);
    const [swArming, setSwArming] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [firedFlash, setFiredFlash] = useState<number | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
    // Per-channel fire pulse length in ms (kept as strings for the inputs).
    const [durationsMs, setDurationsMs] = useState<string[]>(() =>
        channels.map(() => String(defaultFireDurationMs)),
    );
    const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep the duration inputs in sync if the channel list or default changes.
    useEffect(() => {
        setDurationsMs((prev) =>
            channels.map((_, i) => prev[i] ?? String(defaultFireDurationMs)),
        );
    }, [channels.join(","), defaultFireDurationMs]); // eslint-disable-line react-hooks/exhaustive-deps

    const fullyArmed = hardwareArmed === true && softwareArmed === true;
    const anyContinuity = continuity.some((c) => c === true);

    // Ticking clock so "Xs ago" stays live without waiting for the next poll.
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const secondsSinceUpdate =
        lastUpdatedAt !== null ? Math.max(0, Math.floor((nowMs - lastUpdatedAt) / 1000)) : null;
    // Manual re-poll is only offered when data has gone stale — normal polling
    // already refreshes every `pollIntervalMs`, so a button would just be clutter.
    const showRepoll = connected && (secondsSinceUpdate === null || secondsSinceUpdate > 30);

    useEffect(() => {
        if (confirmChannel === null) return;
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setConfirmChannel(null), 5000);
        return () => {
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
        };
    }, [confirmChannel]);

    const canFireChannel = (index: number): boolean => {
        return (
            connected &&
            firingChannel === null &&
            !swArming &&
            hardwareArmed === true &&
            softwareArmed === true &&
            continuity[index] === true
        );
    };

    const fireDisabledReason = (index: number): string => {
        if (!connected) return "Radio link offline";
        if (firingChannel !== null) return "Fire in progress...";
        if (hardwareArmed === null || softwareArmed === null || continuity[index] === null)
            return "Waiting for status...";
        if (hardwareArmed !== true) return "Hardware interlock is SAFE";
        if (softwareArmed !== true) return "Software interlock is SAFE - arm it first";
        if (continuity[index] !== true) return "No continuity on this channel";
        return "";
    };

    const handleFireClick = async (channel: number, durationMs: number) => {
        setActionError(null);
        if (!canFireChannel(channels.indexOf(channel))) return;
        if (confirmChannel !== channel) {
            setConfirmChannel(channel);
            return;
        }
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        setConfirmChannel(null);
        setFiringChannel(channel);
        try {
            await firePyroChanel(channel, durationMs);
            setFiredFlash(channel);
            setTimeout(() => setFiredFlash((f) => (f === channel ? null : f)), 2500);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setFiringChannel(null);
            refresh();
        }
    };

    const handleToggleSoftwareArm = async () => {
        if (!connected || swArming || softwareArmed === null) return;
        setActionError(null);
        setSwArming(true);
        try {
            await setPyroSoftwareArmed(!softwareArmed);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setSwArming(false);
            refresh();
        }
    };

    const statusError = actionError ?? pollError;

    return (
        <Card
            className={`flex flex-col gap-3 p-3 overflow-hidden relative ${className}`}
            variant={fullyArmed && connected ? "warning" : "outer"}
        >
            <div className="flex items-center gap-2">
                <span
                    aria-hidden
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-sm leading-none ${
                        connected && fullyArmed
                            ? "border-red-700/60 bg-red-950/60 text-red-300"
                            : "border-zinc-700/60 bg-zinc-800/60 text-zinc-300"
                    }`}
                >
                    ✸
                </span>
                <div className="flex min-w-0 flex-col">
                    <span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-200" : "text-zinc-500"}`}>
                        Pyro System
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                        {channels.length} channel{channels.length === 1 ? "" : "s"}
                        {connected && secondsSinceUpdate !== null ? ` - ${secondsSinceUpdate}s ago` : ""}
                        {isLoading && connected ? " - sync..." : ""}
                    </span>
                </div>
                <span
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        !connected
                            ? "border-zinc-700/60 bg-zinc-800/50 text-zinc-500"
                            : fullyArmed
                              ? "border-red-700/60 bg-red-950/50 text-red-300"
                              : "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
                    }`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${!connected ? "bg-zinc-600" : fullyArmed ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                    {!connected ? "Offline" : fullyArmed ? "Armed" : "Safe"}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                        hardwareArmed === true
                            ? "border-red-800/60 bg-red-950/40"
                            : hardwareArmed === false
                              ? "border-emerald-800/50 bg-emerald-950/30"
                              : "border-zinc-700/50 bg-zinc-800/40"
                    }`}
                    title="Physical switch on the rocket"
                >
                    <StatusDot state={hardwareArmed} activeColor="bg-red-400" />
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400">HW interlock</span>
                        <span className={`text-xs font-bold tracking-wide ${hardwareArmed === true ? "text-red-300" : hardwareArmed === false ? "text-emerald-300" : "text-zinc-500"}`}>
                            {connected ? armLabel(hardwareArmed, "ARMED") : "NO LINK"}
                        </span>
                    </div>
                </div>
                <div
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                        softwareArmed === true
                            ? "border-amber-700/60 bg-amber-950/40"
                            : softwareArmed === false
                              ? "border-emerald-800/50 bg-emerald-950/30"
                              : "border-zinc-700/50 bg-zinc-800/40"
                    }`}
                    title="Software gate, togglable from this panel"
                >
                    <StatusDot state={softwareArmed} activeColor="bg-amber-400" />
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400">SW interlock</span>
                        <span className={`text-xs font-bold tracking-wide ${softwareArmed === true ? "text-amber-300" : softwareArmed === false ? "text-emerald-300" : "text-zinc-500"}`}>
                            {connected ? armLabel(softwareArmed, "ARMED") : "NO LINK"}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant={softwareArmed === true ? "success" : "warning"}
                    className="flex-1 px-3 py-1.5 text-xs"
                    disabled={!connected || softwareArmed === null || swArming}
                    onClick={handleToggleSoftwareArm}
                    title={softwareArmed === true ? "Return software interlock to SAFE" : "Arm software interlock"}
                >
                    {swArming ? "Sending..." : softwareArmed === true ? "Disarm Software" : "Arm Software"}
                </Button>
                {showRepoll && (
                    <Button
                        variant="ghost"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={refresh}
                        title={secondsSinceUpdate !== null ? `No update for ${secondsSinceUpdate}s - re-poll now` : "Re-poll pyro status now"}
                    >
                        ⟳
                    </Button>
                )}
            </div>
            {!connected ? (
                <p className="text-[11px] text-zinc-500">Radio link offline - status unknown, firing disabled.</p>
            ) : !fullyArmed ? (
                <p className="text-[11px] text-zinc-400">
                    {hardwareArmed !== true
                        ? "Close the hardware switch on the rocket to enable firing."
                        : "Arm the software interlock to enable firing."}
                </p>
            ) : !anyContinuity && continuity.every((c) => c !== null) ? (
                <p className="text-[11px] text-amber-300/90">All interlocks armed, but no channel shows continuity.</p>
            ) : null}
            <div className="flex flex-col gap-2">
                {channels.map((channel, i) => {
                    const cont = continuity[i] ?? null;
                    const firing = firingChannel === channel;
                    const confirming = confirmChannel === channel;
                    const canFire = canFireChannel(i);
                    const label = channelLabels?.[i] ?? `CH ${channel}`;
                    const justFired = firedFlash === channel;
                    // Clamp to the uint16 range the protocol supports; fall back to default on bad input.
                    const rawDuration = Number.parseInt(durationsMs[i] ?? "", 10);
                    const parsedDurationMs =
                        Number.isFinite(rawDuration) ? Math.min(65535, Math.max(1, rawDuration)) : defaultFireDurationMs;
                    return (
                        <div
                            key={channel}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                                justFired
                                    ? "border-amber-500/70 bg-amber-950/40"
                                    : cont === true
                                      ? "border-zinc-700/50 bg-zinc-800/40"
                                      : "border-zinc-700/50 bg-zinc-900/40 opacity-80"
                            }`}
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                                        cont === true
                                            ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
                                            : "border-zinc-700 bg-zinc-800/60 text-zinc-500"
                                    }`}
                                >
                                    {i + 1}
                                </span>
                                <div className="flex min-w-0 flex-col leading-tight">
                                    <span className="truncate text-xs font-semibold text-zinc-200">{label}</span>
                                    <span
                                        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${
                                            cont === true ? "text-emerald-300" : "text-zinc-500"
                                        }`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                cont === true ? "bg-emerald-400" : cont === false ? "bg-zinc-600" : "bg-zinc-600 animate-pulse"
                                            }`}
                                        />
                                        {connected
                                            ? cont === true
                                                ? "Continuity"
                                                : cont === false
                                                  ? "Open / no cont."
                                                  : "Probing..."
                                            : "Unknown"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <Input
                                    type="number"
                                    min={1}
                                    max={65535}
                                    step={50}
                                    value={durationsMs[i] ?? ""}
                                    disabled={!canFire}
                                    onChange={(e) =>
                                        setDurationsMs((prev) => {
                                            const next = [...prev];
                                            next[i] = e.target.value;
                                            return next;
                                        })
                                    }
                                    title="Fire pulse length in ms (1-65535)"
                                    aria-label={`Fire duration in ms for channel ${channel}`}
                                    className="w-12 px-1.5 text-right font-mono"
                                />
                                <span className="text-[10px] text-zinc-500">ms</span>
                                <Button
                                    variant={confirming ? "warning" : justFired ? "success" : "danger"}
                                    className="px-3 py-1.5 text-xs shrink-0 min-w-20"
                                    disabled={!canFire}
                                    title={confirming ? `Click again to confirm firing for ${parsedDurationMs}ms` : fireDisabledReason(i) || `Fire channel ${channel} for ${parsedDurationMs}ms`}
                                    onClick={() => handleFireClick(channel, parsedDurationMs)}
                                >
                                    {firing ? "Firing..." : justFired ? "Fired" : confirming ? "Confirm?" : "Fire"}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {statusError && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{statusError}</span>
                </div>
            )}
        </Card>
    );
}

export default PyroPanel;


