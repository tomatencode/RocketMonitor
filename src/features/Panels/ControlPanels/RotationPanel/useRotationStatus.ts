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
    const { roll_rad, pitch_rad, yaw_rad } = quaternionToEulerXYZ(value);
    return {
        roll_deg: roll_rad * RAD_TO_DEG,
        pitch_deg: pitch_rad * RAD_TO_DEG,
        yaw_deg: yaw_rad * RAD_TO_DEG,
        error,
    };
}
