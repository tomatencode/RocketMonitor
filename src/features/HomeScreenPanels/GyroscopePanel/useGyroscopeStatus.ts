import { useEffect, useRef, useState } from "react";
import { useRocketStatus } from "../../RocketStatus/RocketStatusContext";
import type { LineSample } from "../types";

export interface GyroscopeStatus {
    gyroX: LineSample[];
    gyroY: LineSample[];
    gyroZ: LineSample[];
    error: string | null;
}

/** Memory bound only; the visible window is LineGraph's `maxXinFrame`. */
const MAX_SAMPLES = 100;

/**
 * Reads the shared IMU stream and records the gyroscope axes as time-stamped
 * samples for plotting. Shares the same `imu` poll as the accelerometer panel.
 */
export function useGyroscopeStatus(): GyroscopeStatus {
    const { value: imu, error } = useRocketStatus("imu");

    const [gyroX, setGyroX] = useState<LineSample[]>([]);
    const [gyroY, setGyroY] = useState<LineSample[]>([]);
    const [gyroZ, setGyroZ] = useState<LineSample[]>([]);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!imu) return;
        const t = (Date.now() - startRef.current) / 1000;
        setGyroX(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: imu.gyroX_rad_s }]);
        setGyroY(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: imu.gyroY_rad_s }]);
        setGyroZ(prev => [...prev.slice(-MAX_SAMPLES), { x: t, y: imu.gyroZ_rad_s }]);
    }, [imu]);

    return { gyroX, gyroY, gyroZ, error };
}
