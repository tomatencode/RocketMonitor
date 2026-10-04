import { useRocketStatus } from "../RocketStatus/RocketStatusContext";
import { quaternionToEulerXYZ } from "../RadioLink/useRadioCommands";

export type RocketRotation = [roll: number, pitch: number, yaw: number];

/**
 * Streams the rocket's reported orientation from the shared status store, for
 * the 3D scene. The store holds a quaternion (GET_ROTATION); it is converted
 * to XYZ-Euler radians here to match Three.js' default 'XYZ' order.
 * Falls back to level until the first reading arrives.
 */
export function useRocketOrientation(): RocketRotation {
    const { value } = useRocketStatus("rotation");
    if (!value) return [0, 0, 0];
    const { roll_rad, pitch_rad, yaw_rad } = quaternionToEulerXYZ(value);
    return [roll_rad, pitch_rad, yaw_rad];
}
