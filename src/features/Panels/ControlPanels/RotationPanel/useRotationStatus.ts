import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";
import { quaternionToEulerXYZ } from "../../../RadioLink/useRadioCommands";

export interface RotationStatus {
    roll_deg: number | null;
    pitch_deg: number | null;
    yaw_deg: number | null;
    error: string | null;
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Reads the shared rotation stream (GET_ROTATION, a quaternion) and converts
 * it to Euler angles in degrees — the unit the rest of the UI quotes. Polling
 * is owned by the RocketStatusStore, so this shares the `rotation` poll used
 * by the 3D scene and the rotation chart.
 */
export function useRotationStatus(): RotationStatus {
    const { value, error } = useRocketStatus("rotation");
    if (!value) return { roll_deg: null, pitch_deg: null, yaw_deg: null, error };
    const { x_rad, y_rad, z_rad } = quaternionToEulerXYZ(value);
    return {
        roll_deg: z_rad * RAD_TO_DEG,
        pitch_deg: y_rad * RAD_TO_DEG,
        yaw_deg: x_rad * RAD_TO_DEG,
        error,
    };
}
