import type { FlightState } from "../../../RadioLink/useRadioCommands";
import { Button } from "../../../../shared/components/primitives/Button";
import { FlightTelemetry } from "./FlightTelemetry";
import type { FlightLocationData } from "../../../RadioLink/useRadioCommands";

interface FlightSummaryProps {
    state: FlightState;
    location: FlightLocationData | null;
    maxAltitude_m: number | null;
    elapsedMs: number | null;
    ending: boolean;
    onSetIdle: () => Promise<void>;
}

export function FlightSummary({ state, location, maxAltitude_m, elapsedMs, ending, onSetIdle }: FlightSummaryProps) {
    const aborted = state === 6;

    return (
        <div className="flex flex-col gap-3">
            <p className={`text-xs font-semibold ${aborted ? "text-red-300" : "text-emerald-300"}`}>
                {aborted ? "Flight aborted" : "Flight complete"}
            </p>
            <FlightTelemetry location={location} maxAltitude_m={maxAltitude_m} elapsedMs={elapsedMs} countdownTime_ms={null} />
            <Button variant="neutral" className="w-full px-3 py-2 text-xs" disabled={ending} onClick={() => void onSetIdle()}>
                {ending ? "Setting idle..." : "Set Idle"}
            </Button>
        </div>
    );
}