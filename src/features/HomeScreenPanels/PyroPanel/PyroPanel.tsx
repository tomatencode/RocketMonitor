import { useEffect, useRef, useState } from "react";
import { useRadioLink } from "../../RadioLink/RadioLinkContext";
import { Button } from "../../../shared/components/primitives/Button";
import { Card } from "../../../shared/components/elements/Card";
import { Input } from "../../../shared/components/primitives/Input";
import { StatusDot } from "../../../shared/components/elements/StatusDot";
import { StatusTile } from "../../../shared/components/elements/StatusTile";
import { PanelHeader } from "../../../shared/components/elements/PanelHeader";
import { ChannelRow } from "./ChannelRow";
import { InlineStatus } from "../../../shared/components/elements/InlineStatus";
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
    const { hardwareArmed, softwareArmed, continuity, error: pollError, lastUpdatedAt, refresh } =
        usePyroStatus({ channels, pollIntervalMs, enabled: connected });

    const [firingChannel, setFiringChannel] = useState<number | null>(null);
    const [confirmChannel, setConfirmChannel] = useState<number | null>(null);
    const [swArming, setSwArming] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
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

    const subtitle =
        `${channels.length} channel${channels.length === 1 ? "" : "s"}` +
        (connected && secondsSinceUpdate !== null ? ` - polled ${secondsSinceUpdate}s ago` : "");

    return (
        <Card
            className={`flex flex-col gap-3 p-3 overflow-hidden relative ${className}`}
            variant={fullyArmed && connected ? "warning" : "outer"}
        >
            <PanelHeader
                icon="✸"
                title="Pyro System"
                subtitle={subtitle}
                alert={connected && fullyArmed}
                connected={connected}
            />
            <div className="grid grid-cols-2 gap-2">
                <StatusTile
                    label="HW interlock"
                    value={connected ? armLabel(hardwareArmed, "ARMED") : "NO LINK"}
                    icon={
                        <StatusDot
                            tone={hardwareArmed === true ? "danger" : hardwareArmed === false ? "ok" : "neutral"}
                            pulse={hardwareArmed === true}
                        />
                    }
                    tone={hardwareArmed === true ? "danger" : hardwareArmed === false ? "ok" : "neutral"}
                    title="Physical switch on the rocket"
                />
                <StatusTile
                    label="SW interlock"
                    value={connected ? armLabel(softwareArmed, "ARMED") : "NO LINK"}
                    icon={
                        <StatusDot
                            tone={softwareArmed === true ? "warn" : softwareArmed === false ? "ok" : "neutral"}
                            pulse={softwareArmed === true}
                        />
                    }
                    tone={softwareArmed === true ? "warn" : softwareArmed === false ? "ok" : "neutral"}
                    title="Software gate, togglable from this panel"
                />
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
                    // Clamp to the uint16 range the protocol supports; fall back to default on bad input.
                    const rawDuration = Number.parseInt(durationsMs[i] ?? "", 10);
                    const parsedDurationMs =
                        Number.isFinite(rawDuration) ? Math.min(65535, Math.max(1, rawDuration)) : defaultFireDurationMs;
                    return (
                        <ChannelRow
                            key={channel}
                            index={i}
                            label={label}
                            tone={cont === true ? "ok" : "neutral"}
                            dimmed={cont !== true}
                            status={
                                <InlineStatus
                                    tone={!connected || cont === null ? "neutral" : cont === true ? "ok" : "neutral"}
                                    pulse={connected && cont === null}
                                >
                                    {connected
                                        ? cont === true
                                            ? "Continuity"
                                            : cont === false
                                              ? "Open / no cont."
                                              : "Probing..."
                                        : "Unknown"}
                                </InlineStatus>
                            }
                            controls={
                                <>
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
                                        variant={confirming ? "warning" : "danger"}
                                        className="px-3 py-1.5 text-xs shrink-0 min-w-20"
                                        disabled={!canFire}
                                        title={confirming ? `Click again to confirm firing for ${parsedDurationMs}ms` : fireDisabledReason(i) || `Fire channel ${channel} for ${parsedDurationMs}ms`}
                                        onClick={() => handleFireClick(channel, parsedDurationMs)}
                                    >
                                        {firing ? "Firing..." : confirming ? "Confirm?" : "Fire"}
                                    </Button>
                                </>
                            }
                        />
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


