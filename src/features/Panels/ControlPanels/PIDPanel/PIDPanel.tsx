import { useEffect, useState } from "react";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketConnected } from "../../../RocketStatus/RocketStatusContext";
import { Button } from "../../../../shared/components/primitives/Button";
import { Card } from "../../../../shared/components/elements/Card";
import { Input } from "../../../../shared/components/primitives/Input";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { PidIcon } from "../../../../shared/components/elements/Icons";
import { StatusDot } from "../../../../shared/components/elements/StatusDot";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { StatusTile } from "../../../../shared/components/elements/StatusTile";
import { usePIDStatus } from "./usePIDStatus";

export interface PIDPanelProps {
    className?: string;
}

/** Parses a gain input, returning null when empty or not a finite number. */
function parseGain(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function fmt(gain: number | null): string {
    return gain === null ? "--" : gain.toFixed(2);
}

type ControllingState = boolean | null;

function controllingPill(state: ControllingState) {
    if (state === null) return { tone: "neutral" as const, pulse: false, label: "Unknown" };
    if (state) return { tone: "ok" as const, pulse: true, label: "Controlling" };
    return { tone: "neutral" as const, pulse: false, label: "Idle" };
}

/**
 * Sets the firmware's PID gains (Kp/Ki/Kd) and starts/stops the attitude
 * controller. Shows the live gains + controlling state polled from the rocket.
 */
export function PIDPanel({ className = "" }: PIDPanelProps) {
    const connected = useRocketConnected();
    const { setPIDParameters, setControlling } = useRocketCommander();
    const { parameters, controlling, error: pollError } = usePIDStatus();

    // Gain inputs mirror the last polled values until the user edits them.
    const [kpInput, setKpInput] = useState("");
    const [kiInput, setKiInput] = useState("");
    const [kdInput, setKdInput] = useState("");
    const [editing, setEditing] = useState(false);

    const [sending, setSending] = useState(false);
    const [controllingBusy, setControllingBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Re-sync the inputs once the rocket reports values, and keep them in
    // sync whenever they change outside an edit session.
    useEffect(() => {
        if (editing || !parameters) return;
        setKpInput(parameters.kp.toFixed(2));
        setKiInput(parameters.ki.toFixed(2));
        setKdInput(parameters.kd.toFixed(2));
    }, [editing, parameters]);

    const kp = parseGain(kpInput);
    const ki = parseGain(kiInput);
    const kd = parseGain(kdInput);
    const gainsValid = kp !== null && ki !== null && kd !== null;

    const handleSetParameters = async () => {
        if (kp === null || ki === null || kd === null) return;
        setActionError(null);
        setSending(true);
        try {
            await setPIDParameters(kp, ki, kd);
            // Commander requests confirmed status; preserve inputs until editing ends.
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setSending(false);
        }
    };

    const handleSetControlling = async (next: boolean) => {
        setActionError(null);
        setControllingBusy(true);
        try {
            await setControlling(next);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setControllingBusy(false);
        }
    };

    const statusError = actionError ?? pollError;
    const pill = controllingPill(controlling);

    const startStopDisabled = !connected || controllingBusy || parameters === null;

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<PidIcon />}
                title="PID Controller"
                subtitle="Kp / Ki / Kd gains"
                connected={connected}
                end={
                    <StatusPill tone={pill.tone} pulse={pill.pulse}>
                        {pill.label}
                    </StatusPill>
                }
            />
            <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Kp</span>
                    <Input
                        type="number"
                        step={0.01}
                        value={kpInput}
                        disabled={!connected}
                        onChange={(e) => {
                            setEditing(true);
                            setKpInput(e.target.value);
                        }}
                        aria-label="Proportional gain"
                        className="px-1.5 text-right font-mono"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Ki</span>
                    <Input
                        type="number"
                        step={0.01}
                        value={kiInput}
                        disabled={!connected}
                        onChange={(e) => {
                            setEditing(true);
                            setKiInput(e.target.value);
                        }}
                        aria-label="Integral gain"
                        className="px-1.5 text-right font-mono"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Kd</span>
                    <Input
                        type="number"
                        step={0.01}
                        value={kdInput}
                        disabled={!connected}
                        onChange={(e) => {
                            setEditing(true);
                            setKdInput(e.target.value);
                        }}
                        aria-label="Derivative gain"
                        className="px-1.5 text-right font-mono"
                    />
                </label>
            </div>
            <Button
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                disabled={!connected || !gainsValid || sending}
                title={gainsValid ? "Send the entered gains to the rocket" : "Enter a number for each gain"}
                onClick={handleSetParameters}
            >
                {sending ? "Setting..." : "Set Parameters"}
            </Button>
            <div className="grid grid-cols-1 gap-2">
                <Button
                    variant={controlling === true ? "neutral" : "success"}
                    className="px-3 py-1.5 text-xs"
                    disabled={startStopDisabled}
                    title={
                        parameters === null
                            ? "Configure the gains first — starting is refused without them"
                            : "Start driving the gimbal with the attitude controller"
                    }
                    onClick={() => handleSetControlling(!controlling)}
                >
                    {controllingBusy ? "Sending..." : controlling === true ? "Stop Controlling" : "Start Controlling"}
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <StatusTile
                    label="Kp"
                    value={fmt(parameters ? parameters.kp : null)}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} />}
                    tone={connected ? "info" : "neutral"}
                    title="Proportional gain reported by the rocket"
                />
                <StatusTile
                    label="Ki"
                    value={fmt(parameters ? parameters.ki : null)}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} />}
                    tone={connected ? "info" : "neutral"}
                    title="Integral gain reported by the rocket"
                />
                <StatusTile
                    label="Kd"
                    value={fmt(parameters ? parameters.kd : null)}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} />}
                    tone={connected ? "info" : "neutral"}
                    title="Derivative gain reported by the rocket"
                />
            </div>
            {!connected && (
                <p className="text-[11px] text-zinc-500">Radio link offline — status unknown, tuning disabled.</p>
            )}
            {statusError && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{statusError}</span>
                </div>
            )}
        </Card>
    );
}

export default PIDPanel;
