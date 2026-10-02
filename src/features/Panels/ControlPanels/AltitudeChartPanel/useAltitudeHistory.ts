import type { LineSample } from "../types";

export interface AltitudeHistory {
    altitude: LineSample[];
    error: string | null;
    /** True while there is no altitude state to read; the panel shows a placeholder note. */
    pending: boolean;
}

/**
 * Altitude is not implemented yet, so this returns an empty series and flags
 * `pending` to let the panel explain why nothing is plotting.
 *
 * TODO(altitude): once the state exists, follow the same pattern as the other
 * chart hooks — subscribe with `useRocketStatus("<topic>")` (or read whatever
 * holds the state), push `{ x, y }` samples into an `altitude` array bounded by
 * `MAX_SAMPLES`, and return `pending: false`. Only this hook needs to change;
 * the panel already renders whatever comes back.
 */
export function useAltitudeHistory(): AltitudeHistory {
    return { altitude: [], error: null, pending: true };
}
