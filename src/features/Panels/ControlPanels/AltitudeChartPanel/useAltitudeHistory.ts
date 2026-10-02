import { useCallback, useEffect, useRef, useState } from "react";
import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";
import type { LineSample } from "../types";

export interface AltitudeHistory {
    /** Latest height above the launch pad in metres; null before the first reading. */
    height: number | null;
    altitude: LineSample[];
    error: string | null;
    /** Drops all plotted samples — used after a recalibration invalidates the history. */
    reset: () => void;
}

/** Memory bound only; the visible window is LineGraph's `maxXinFrame`. */
const MAX_SAMPLES = 100;

/**
 * Reads the shared barometric-height stream (GET_BARO_HEIGHT) and records the
 * height above the launch pad as time-stamped samples for plotting. Shares the
 * same `baroHeight` poll as any other consumer, so it costs no extra radio
 * traffic.
 */
export function useAltitudeHistory(): AltitudeHistory {
    const { value: height, error } = useRocketStatus("baroHeight");

    const [altitude, setAltitude] = useState<LineSample[]>([]);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (height === null) return;
        const t = (Date.now() - startRef.current) / 1000;
        setAltitude(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: height }]);
    }, [height]);

    const reset = useCallback(() => {
        startRef.current = Date.now();
        setAltitude([]);
    }, []);

    return { height, altitude, error, reset };
}
