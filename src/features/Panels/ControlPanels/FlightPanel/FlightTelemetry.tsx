import type { FlightLocationData } from "../../../RocketStatus/rocketTypes";
import { Card } from "../../../../shared/components/elements/Card";

interface FlightTelemetryProps {
    location: FlightLocationData | null;
    maxAltitude_m: number | null;
    elapsedMs: number | null;
    countdownTime_ms: number | null;
}

function formatNumber(value: number | null, suffix: string): string {
    return value === null ? "--" : `${value.toFixed(1)} ${suffix}`;
}

export function formatFlightTime(elapsedMs: number | null): string {
    if (elapsedMs === null) return "--:--";
    const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function FlightTelemetry({ location, maxAltitude_m, elapsedMs, countdownTime_ms }: FlightTelemetryProps) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            {countdownTime_ms !== null && (
                <Card variant="warning" className="flex flex-col items-center gap-1 px-3 py-4">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/70">Launch countdown</span>
                    <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-amber-300">T-{(Math.max(0, countdownTime_ms) / 1000).toFixed(1)} <span className="text-sm text-amber-300/60">s</span></span>
                </Card>
            )}
            <div className="grid grid-cols-2 gap-2">
                <Card variant="info" className="min-w-0 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-sky-300/70">Altitude</p>
                    <p className="mt-2 break-words font-mono text-xl font-semibold tabular-nums tracking-tight text-sky-200">{formatNumber(location?.height_m ?? null, "m")}</p>
                </Card>
                <Card variant="inner" className="min-w-0 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">Velocity</p>
                    <p className="mt-2 break-words font-mono text-xl font-semibold tabular-nums tracking-tight text-zinc-200">{formatNumber(location?.verticalVelocity_m_s ?? null, "m/s")}</p>
                </Card>
                <Card variant="inner" className="min-w-0 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Peak altitude</p>
                    <p className="mt-1 break-words font-mono text-sm font-medium tabular-nums text-zinc-300">{formatNumber(maxAltitude_m, "m")}</p>
                </Card>
                <Card variant="inner" className="min-w-0 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Flight time</p>
                    <p className="mt-1 font-mono text-sm font-medium tabular-nums text-zinc-300">{formatFlightTime(elapsedMs)}</p>
                </Card>
            </div>
        </div>
    );
}