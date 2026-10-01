import { useEffect, useRef, useState } from "react";
import { useRocketStatus } from "../../RocketStatus/RocketStatusContext";
import type { LineSample } from "../types";

export interface AccelerometerStatus {
    accelX: LineSample[];
    accelY: LineSample[];
    accelZ: LineSample[];
    error: string | null;
}

/** Memory bound only; the visible window is LineGraph's `maxXinFrame`. */
const MAX_SAMPLES = 100;

/**
 * Reads the shared IMU stream and records the accelerometer axes as
 * time-stamped samples for plotting.
 */
export function useAccelerometerStatus(): AccelerometerStatus {
    const { value: imu, error } = useRocketStatus("imu");

    const [accelX, setAccelX] = useState<LineSample[]>([]);
    const [accelY, setAccelY] = useState<LineSample[]>([]);
    const [accelZ, setAccelZ] = useState<LineSample[]>([]);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!imu) return;
        const t = (Date.now() - startRef.current) / 1000;
        setAccelX(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: imu.accelX_m_s2 }]);
        setAccelY(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: imu.accelY_m_s2 }]);
        setAccelZ(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: imu.accelZ_m_s2 }]);
    }, [imu]);

    return { accelX, accelY, accelZ, error };
}
