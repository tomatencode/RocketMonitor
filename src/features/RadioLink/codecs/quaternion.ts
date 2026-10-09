import { decode32, encode32, ENCODED_32_SIZE } from "./fixedPoint";

/**
 * Quaternion wire codec mirroring the firmware's
 * `radioLink/requestHandlers/QuaternionCodec.hpp`, plus XYZ-Euler helpers.
 *
 * Components travel in (x, y, z, w) order, each one an int32 fixed-point
 * value scaled by `fixedPoint::kScale` (100), so a quaternion occupies
 * 16 bytes on the wire.
 */

import type { Quaternion } from "../../RocketStatus/quaternion";
export type { Quaternion, EulerXYZ } from "../../RocketStatus/quaternion";
export { normalizeQuaternion, quaternionToEulerXYZ, eulerXYZToQuaternion } from "../../RocketStatus/quaternion";

/** Wire size of an encoded quaternion in bytes (4 × int32). */
export const ENCODED_SIZE = 4 * ENCODED_32_SIZE; // 16 bytes

/** Encodes `q` (x, y, z, w) into buffer[offset..offset+16). */
export function encode(q: Quaternion, buffer: Uint8Array, offset: number): void {
    encode32(q.x, buffer, offset + 0);
    encode32(q.y, buffer, offset + 4);
    encode32(q.z, buffer, offset + 8);
    encode32(q.w, buffer, offset + 12);
}

/** Decodes a quaternion (x, y, z, w) from buffer[offset..offset+16). */
export function decode(buffer: Uint8Array, offset: number): Quaternion {
    return {
        x: decode32(buffer, offset + 0),
        y: decode32(buffer, offset + 4),
        z: decode32(buffer, offset + 8),
        w: decode32(buffer, offset + 12),
    };
}
