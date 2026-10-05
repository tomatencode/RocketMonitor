import { useState } from "react";
import { useRadioLink } from "../../../RadioLink/RadioLinkContext";
import { eulerXYZToQuaternion } from "../../../RadioLink/useRadioCommands";
import { Button } from "../../../../shared/components/primitives/Button";
import { Card } from "../../../../shared/components/elements/Card";
import { Input } from "../../../../shared/components/primitives/Input";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { RotationIcon } from "../../../../shared/components/elements/Icons";
import { StatusDot } from "../../../../shared/components/elements/StatusDot";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { StatusTile } from "../../../../shared/components/elements/StatusTile";
import { useRotationStatus } from "./useRotationStatus";

export interface RotationPanelProps {
    className?: string;
}

const DEG_TO_RAD = Math.PI / 180;

/** Parses a degrees input, returning null when empty or not a finite number. */
function parseDegrees(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function fmt(deg: number | null): string {
    return deg === null ? "--" : `${deg >= 0 ? "+" : ""}${deg.toFixed(1)}°`;
}

type AccumulationState = boolean | null;

function accumulationPill(state: AccumulationState) {
    if (state === null) return { tone: "neutral" as const, pulse: false, label: "Unknown" };
    if (state) return { tone: "ok" as const, pulse: true, label: "Accumulating" };
    return { tone: "neutral" as const, pulse: false, label: "Stopped" };
}

/**
 * Sets the accumulated attitude (roll/pitch/yaw in degrees, converted to the
 * quaternion the protocol expects) and starts/stops the firmware's gyro
 * accumulation. Shows the live attitude reported by GET_ROTATION.
 */
export function RotationPanel({ className = "" }: RotationPanelProps) {
    const { connected, setRotation, setAccumulatingRotation } = useRadioLink();
    const { roll_deg, pitch_deg, yaw_deg, error: pollError } = useRotationStatus();

    // Angle inputs in degrees — the unit the rest of the UI quotes.
    const [rollInput, setRollInput] = useState("0");
    const [pitchInput, setPitchInput] = useState("0");
    const [yawInput, setYawInput] = useState("0");

    const [sending, setSending] = useState(false);
    const [accumulating, setAccumulating] = useState<AccumulationState>(null);
    const [accumulationBusy, setAccumulationBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const roll = parseDegrees(rollInput);
    const pitch = parseDegrees(pitchInput);
    const yaw = parseDegrees(yawInput);
    const anglesValid = roll !== null && pitch !== null && yaw !== null;

    const handleSetRotation = async () => {
        if (roll === null || pitch === null || yaw === null) return;
        setActionError(null);
        setSending(true);
        try {
            await setRotation(eulerXYZToQuaternion(yaw * DEG_TO_RAD, pitch * DEG_TO_RAD, roll * DEG_TO_RAD));
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setSending(false);
        }
    };

    const handleAccumulation = async (next: boolean) => {
        setActionError(null);
        setAccumulationBusy(true);
        try {
            await setAccumulatingRotation(next);
            setAccumulating(next);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setAccumulationBusy(false);
        }
    };

    const statusError = actionError ?? pollError;
    const pill = accumulationPill(accumulating);

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<RotationIcon />}
                title="Rotation"
                subtitle="roll / pitch / yaw"
                connected={connected}
                end={
                    <StatusPill tone={pill.tone} pulse={pill.pulse}>
                        {pill.label}
                    </StatusPill>
                }
            />
            <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Roll (°)</span>
                    <Input
                        type="number"
                        step={1}
                        value={rollInput}
                        disabled={!connected}
                        onChange={(e) => setRollInput(e.target.value)}
                        aria-label="Roll in degrees"
                        className="px-1.5 text-right font-mono"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Pitch (°)</span>
                    <Input
                        type="number"
                        step={1}
                        value={pitchInput}
                        disabled={!connected}
                        onChange={(e) => setPitchInput(e.target.value)}
                        aria-label="Pitch in degrees"
                        className="px-1.5 text-right font-mono"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Yaw (°)</span>
                    <Input
                        type="number"
                        step={1}
                        value={yawInput}
                        disabled={!connected}
                        onChange={(e) => setYawInput(e.target.value)}
                        aria-label="Yaw in degrees"
                        className="px-1.5 text-right font-mono"
                    />
                </label>
            </div>
            <Button
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                disabled={!connected || !anglesValid || sending}
                title={anglesValid ? "Send the entered roll/pitch/yaw as the accumulated attitude" : "Enter a number for each axis"}
                onClick={handleSetRotation}
            >
                {sending ? "Setting..." : "Set Rotation"}
            </Button>
            <div className="grid grid-cols-1 gap-2">
                <Button
                    variant={accumulating === true ? "neutral" : "success"}
                    className="px-3 py-1.5 text-xs"
                    disabled={!connected || accumulationBusy }
                    title="Start integrating the IMU gyro into the attitude"
                    onClick={() => handleAccumulation(!accumulating)}
                >
                    {accumulationBusy ? "Sending..." : accumulating === true ? "Stop Accumulating" : "Start Accumulating"}
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <StatusTile
                    label="Roll"
                    value={fmt(roll_deg)}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} />}
                    tone={connected ? "info" : "neutral"}
                    title="Live roll reported by the rocket"
                />
                <StatusTile
                    label="Pitch"
                    value={fmt(pitch_deg)}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} />}
                    tone={connected ? "info" : "neutral"}
                    title="Live pitch reported by the rocket"
                />
                <StatusTile
                    label="Yaw"
                    value={fmt(yaw_deg)}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} />}
                    tone={connected ? "info" : "neutral"}
                    title="Live yaw reported by the rocket"
                />
            </div>
            {statusError && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{statusError}</span>
                </div>
            )}
        </Card>

    );
}

export default RotationPanel;
