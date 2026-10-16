import type { FlightLocationData } from "../../../RocketStatus/rocketTypes";
import { Card } from "../../../../shared/components/elements/Card";

interface FlightTelemetryProps {
    location: FlightLocationData | null;
    maxAltitude_m: number | null;
    maxVelocity_m_s: number | null;
    elapsedMs: number | null;
    countdownTime_ms: number | null;
    countingDown?: boolean;
}

function formatNumber(value: number | null, suffix: string): string {
    return value === null ? "--" : `${value.toFixed(1)} ${suffix}`;
}

export function formatFlightTime(elapsedMs: number | null): string {
    return elapsedMs === null ? "T+--s" : `T+${(Math.max(0, elapsedMs) / 1000).toFixed(1)}s`;
}

export function FlightTelemetry({ location, maxAltitude_m, maxVelocity_m_s, elapsedMs, countdownTime_ms, countingDown = countdownTime_ms !== null }: FlightTelemetryProps) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Card variant={countingDown ? "warning" : "inner"} className="flex flex-col items-center gap-1 px-3 py-4">
                <span className={`text-[10px] uppercase tracking-[0.2em] ${countingDown ? "text-amber-300/70" : "text-zinc-400"}`}>{countingDown ? "Launch countdown" : "Flight time"}</span>
                <span className={`font-mono text-3xl font-semibold tabular-nums tracking-tight ${countingDown ? "text-amber-300" : "text-zinc-200"}`}>
                    {countingDown ? countdownTime_ms === null ? "T−--s" : `T-${(Math.max(0, countdownTime_ms) / 1000).toFixed(1)}s` : formatFlightTime(elapsedMs)}
                </span>
            </Card>
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
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Peak velocity</p>
                    <p className="mt-1 break-words font-mono text-sm font-medium tabular-nums text-zinc-300">{formatNumber(maxVelocity_m_s, "m/s")}</p>
                </Card>
            </div>
        </div>
    );
}