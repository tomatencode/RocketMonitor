import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";

export interface RotationStatus {
    roll_deg: number | null;
    pitch_deg: number | null;
    yaw_deg: number | null;
    error: string | null;
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Reads the shared rotation stream (GET_ROTATION) and converts the Euler angles
 * from radians to degrees — the unit the rest of the UI quotes. Polling is owned
 * by the RocketStatusStore, so this shares the `rotation` poll used by the 3D
 * scene and the rotation chart.
 */
export function useRotationStatus(): RotationStatus {
    const { value, error } = useRocketStatus("rotation");
    return {
        roll_deg: value ? value.roll_rad * RAD_TO_DEG : null,
        pitch_deg: value ? value.pitch_rad * RAD_TO_DEG : null,
        yaw_deg: value ? value.yaw_rad * RAD_TO_DEG : null,
        error,
    };
}
