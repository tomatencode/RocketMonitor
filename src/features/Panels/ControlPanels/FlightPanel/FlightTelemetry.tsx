import type { FlightLocationData } from "../../../RocketStatus/rocketTypes";
import { StatusDot } from "../../../../shared/components/elements/StatusDot";
import { StatusTile } from "../../../../shared/components/elements/StatusTile";

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
        <div className="flex flex-col gap-2">
            {countdownTime_ms !== null && (
                <div className="border border-amber-700/60 bg-amber-950/30 px-2.5 py-2 text-center text-xs font-semibold text-amber-300">
                    T-{(countdownTime_ms / 1000).toFixed(1)} s
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                <StatusTile label="Velocity" value={formatNumber(location?.verticalVelocity_m_s ?? null, "m/s")} icon={<StatusDot tone="info" />} tone="info" />
                <StatusTile label="Altitude" value={formatNumber(location?.height_m ?? null, "m")} icon={<StatusDot tone="ok" />} tone="ok" />
                <StatusTile label="Peak altitude" value={formatNumber(maxAltitude_m, "m")} icon={<StatusDot tone="warn" />} tone="warn" />
                <StatusTile label="Flight time" value={formatFlightTime(elapsedMs)} icon={<StatusDot tone="neutral" />} />
            </div>
        </div>
    );
}