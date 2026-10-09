import { useRocketStatus } from "../RocketStatus/RocketStatusContext";
import { quaternionToEulerXYZ } from "../RocketStatus/rocketTypes";

export type RocketRotation = [x: number, y: number, z: number];

/**
 * Streams the rocket's reported orientation from the shared status store, for
 * the 3D scene. The store holds a quaternion (GET_ROTATION); it is converted
 * to XYZ-Euler radians here to match Three.js' default 'XYZ' order. The
 * firmware calls the body axes yaw (X), pitch (Y), and roll (Z), while this
 * tuple must remain in Three.js coordinate order X, Y, Z.
 * Falls back to level until the first reading arrives.
 */
export function useRocketOrientation(): RocketRotation {
    const { value } = useRocketStatus("rotation");
    if (!value) return [0, 0, 0];
    const {x_rad,y_rad,z_rad} = quaternionToEulerXYZ({x:value.x,y:value.z,z:-value.y,w:value.w}); // sceene y up
    return [x_rad,y_rad,z_rad];

}
