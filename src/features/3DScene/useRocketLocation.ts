import type { FlightLocationData } from "../RocketStatus/rocketTypes";
import { useRocketStatus } from "../RocketStatus/RocketStatusContext";

export type RocketPosition = [x: number, y: number, z: number];

/**
 * Streams the rocket's reported position from the shared status store, for
 * the 3D scene. The store holds the rocket's position in the body frame.
 * Falls back to the origin until the first reading arrives.
 */
export function useRocketLocation(): RocketPosition {
    const { value } = useRocketStatus("flightLocation");
    if (!value) return [0, 0.155, 0];
    const { posX_m, posY_m, height_m } = value as FlightLocationData;
    return [posX_m, height_m + 0.155, posY_m];
}
