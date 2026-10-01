import { useRocketStatus } from "../RocketStatus/RocketStatusContext";

export type RocketRotation = [roll: number, pitch: number, yaw: number];

/**
 * Streams the rocket's reported orientation from the shared status store, for
 * the 3D scene. Falls back to level until the first reading arrives.
 */
export function useRocketOrientation(): RocketRotation {
    const { value } = useRocketStatus("rotation");
    return value ? [value.roll_rad, value.pitch_rad, value.yaw_rad] : [0, 0, 0];
}
