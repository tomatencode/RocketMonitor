import { useEffect, useRef, useState } from "react";
import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";
import type { LineSample } from "../types";

export interface GimbalHistory {
    gimbalX: LineSample[];
    gimbalY: LineSample[];
    error: string | null;
}

/** Memory bound only; the visible window is LineGraph's `maxXinFrame`. */
const MAX_SAMPLES = 100;

/**
 * Reads the shared gimbal stream (GET_GIMBAL) and records the X/Y deflection
 * as time-stamped samples for plotting. Shares the same `gimbal` poll as the
 * GimbalPanel controls, so it costs no extra radio traffic.
 */
export function useGimbalHistory(): GimbalHistory {
    const { value: gimbal, error } = useRocketStatus("gimbal");

    const [gimbalX, setGimbalX] = useState<LineSample[]>([]);
    const [gimbalY, setGimbalY] = useState<LineSample[]>([]);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!gimbal) return;
        const t = (Date.now() - startRef.current) / 1000;
        setGimbalX(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: gimbal.degX_deg }]);
        setGimbalY(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: gimbal.degY_deg }]);
    }, [gimbal]);

    return { gimbalX, gimbalY, error };
}
