import { useEffect, useRef, useState } from "react";
import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";
import { quaternionToEulerXYZ } from "../../../RocketStatus/rocketTypes";
import type { LineSample } from "../types";

export interface RotationHistory {
    roll: LineSample[];
    pitch: LineSample[];
    yaw: LineSample[];
    error: string | null;
}

/** Memory bound only; the visible window is LineGraph's `maxXinFrame`. */
const MAX_SAMPLES = 100;

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Reads the shared rotation stream and records roll/pitch/yaw as time-stamped
 * samples for plotting. Values are converted from radians to degrees so the
 * chart reads in the same unit the rest of the UI quotes. Shares the same
 * `rotation` poll as the 3D scene, so it costs no extra radio traffic.
 */
export function useRotationHistory(): RotationHistory {
    const { value: rotation, error } = useRocketStatus("rotation");

    const [roll, setRoll] = useState<LineSample[]>([]);
    const [pitch, setPitch] = useState<LineSample[]>([]);
    const [yaw, setYaw] = useState<LineSample[]>([]);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!rotation) return;
        const { x_rad, y_rad, z_rad } = quaternionToEulerXYZ(rotation);
        const t = (Date.now() - startRef.current) / 1000;
        setRoll(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: z_rad * RAD_TO_DEG }]);
        setPitch(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: y_rad * RAD_TO_DEG }]);
        setYaw(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: x_rad * RAD_TO_DEG }]);
    }, [rotation]);

    return { roll, pitch, yaw, error };
}
