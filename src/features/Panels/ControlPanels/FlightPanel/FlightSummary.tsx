import { FlightState } from "../../../RocketStatus/rocketTypes";
import { Card } from "../../../../shared/components/elements/Card";
import { Button } from "../../../../shared/components/primitives/Button";
import { FlightTelemetry } from "./FlightTelemetry";
import type { FlightLocationData } from "../../../RocketStatus/rocketTypes";

interface FlightSummaryProps {
    state: FlightState;
    location: FlightLocationData | null;
    maxAltitude_m: number | null;
    elapsedMs: number | null;
    ending: boolean;
    onSetIdle: () => Promise<void>;
}

export function FlightSummary({ state, location, maxAltitude_m, elapsedMs, ending, onSetIdle }: FlightSummaryProps) {
    const aborted = state === FlightState.ABORTED;

    return (
        <div className="flex flex-col gap-3">
            <Card variant={aborted ? "error" : "success"} className="flex flex-col gap-1 p-3" role="status">
                <p className={`text-xs font-semibold ${aborted ? "text-red-300" : "text-emerald-300"}`}>
                    {aborted ? "Flight aborted" : "Flight complete"}
                </p>
                <p className="text-[11px] leading-relaxed text-zinc-400">Review the flight readings below. Set idle to return to flight setup.</p>
            </Card>
            <FlightTelemetry location={location} maxAltitude_m={maxAltitude_m} elapsedMs={elapsedMs} countdownTime_ms={null} />
            <Button variant="neutral" className="w-full px-3 py-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" disabled={ending} onClick={() => void onSetIdle()}>
                {ending ? "Setting idle..." : "Set Idle"}
            </Button>
        </div>
    );
}
