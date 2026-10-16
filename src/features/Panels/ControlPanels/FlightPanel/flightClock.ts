import { FlightState } from "../../../RocketStatus/rocketTypes";

export const isAirborneFlight = (state: FlightState) => state >= FlightState.BURNING && state <= FlightState.DESCENDING;

/** T+ begins at the first observed post-countdown phase, never during countdown. */
export function updateFlightClock(state: FlightState, startedAt: number | null, elapsedMs: number | null, now: number) {
    if (state === FlightState.COUNTDOWN || state === FlightState.IDLE) return { startedAt: null, elapsedMs: null };
    if (isAirborneFlight(state)) {
        const start = startedAt ?? now;
        return { startedAt: start, elapsedMs: Math.max(0, now - start) };
    }
    return { startedAt: null, elapsedMs: startedAt === null ? elapsedMs : Math.max(0, now - startedAt) };
}