import { useEffect, useRef, useState } from "react";
import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";
import type { LineSample } from "../types";

export interface BarometerStatus {
    pressure: LineSample[];
    error: string | null;
}

/** Memory bound only; the visible window is LineGraph's `maxXinFrame`. */
const MAX_SAMPLES = 100;

/**
 * Reads the shared barometer stream and records the pressure (converted to hPa)
 * as time-stamped samples for plotting.
 */
export function useBarometerStatus(): BarometerStatus {
    const { value: baro, error } = useRocketStatus("baro");

    const [pressure, setPressure] = useState<LineSample[]>([]);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!baro) return;
        const t = (Date.now() - startRef.current) / 1000;
        setPressure(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: baro.pressure_Pa / 100 }]);
    }, [baro]);

    return { pressure, error };
}
