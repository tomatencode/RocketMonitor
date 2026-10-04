import { Card } from "../../../../shared/components/elements/Card";
import { BatteryIcon } from "../../../../shared/components/elements/Icons";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { useBatteryStatus } from "./useBatteryStatus";

export interface BatteryPanelProps {
    className?: string;
}

/**
 * Single-cell LiPo reference voltages (V). The firmware reads the pack through
 * a 57/47 divider that tops out at ~4.0 V, so the pack is treated as one cell.
 * Adjust these constants if a different battery chemistry is fitted.
 */
const LOW_VOLTAGE_V = 3.5;
const CRITICAL_VOLTAGE_V = 3.3;

type BatteryTone = "neutral" | "ok" | "warn" | "danger";

function voltageTone(voltage: number | null): BatteryTone {
    if (voltage === null) return "neutral";
    if (voltage < CRITICAL_VOLTAGE_V) return "danger";
    if (voltage < LOW_VOLTAGE_V) return "warn";
    return "ok";
}

const valueColor: Record<BatteryTone, string> = {
    neutral: "text-zinc-500",
    ok: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-red-300",
};

const statusLabel: Record<BatteryTone, string> = {
    neutral: "No data",
    ok: "Nominal",
    warn: "Low",
    danger: "Critical",
};

/**
 * Displays the main pack voltage polled via GET_BATTERY_VOLTAGE, colouring the
 * readout and status pill by how close the pack is to its low/critical
 * thresholds.
 */
export function BatteryPanel({ className = "" }: BatteryPanelProps) {
    const { voltage, error } = useBatteryStatus();
    const tone = voltageTone(voltage);

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<BatteryIcon />}
                title="Battery"
                subtitle="pack voltage"
                alert={tone === "danger"}
                connected={voltage !== null}
                end={
                    <StatusPill tone={tone} pulse={tone === "danger"}>
                        {statusLabel[tone]}
                    </StatusPill>
                }
            />
            <div className="flex items-baseline gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2">
                <span className={`font-mono text-3xl font-bold tabular-nums ${valueColor[tone]}`}>
                    {voltage === null ? "--.--" : voltage.toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-zinc-500">V</span>
            </div>
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default BatteryPanel;
