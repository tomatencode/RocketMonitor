import { decode32, encode32, ENCODED_32_SIZE } from "./fixedPoint";

/**
 * Quaternion wire codec mirroring the firmware's
 * `radioLink/requestHandlers/QuaternionCodec.hpp`, plus XYZ-Euler helpers.
 *
 * Components travel in (x, y, z, w) order, each one an int32 fixed-point
 * value scaled by `fixedPoint::kScale` (100), so a quaternion occupies
 * 16 bytes on the wire.
 */

/** Attitude quaternion (x, y, z, w) as used by the firmware's Eigen::Quaternionf. */
export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

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

/**
 * Quaternion <-> XYZ-Euler conversions matching the firmware's Eigen convention.
 *
 * The firmware builds its attitude as R = Rx(roll) * Ry(pitch) * Rz(yaw)
 * (see `RotationAccumulator::setEulerAngles_rad`, and `getEulerAngles_rad`
 * which reads it back via `eulerAngles(0, 1, 2)`). Three.js consumes Euler
 * triples in its default 'XYZ' order, which produces the same
 * R = Rx * Ry * Rz matrix — so these helpers keep the 3D scene, the chart
 * and the panel in agreement with the rocket.
 */

/** Returns a unit-length copy of `q` (identity when `q` has zero length). */
export function normalizeQuaternion(q: Quaternion): Quaternion {
    const norm = Math.hypot(q.x, q.y, q.z, q.w);
    if (!(norm > 0)) return { x: 0, y: 0, z: 0, w: 1 };
    return { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm };
}

export interface EulerXYZ {
    roll_rad: number;
    pitch_rad: number;
    yaw_rad: number;
}

/**
 * Converts a (possibly unnormalised, e.g. fixed-point x100 wire) quaternion
 * to XYZ-Euler angles in radians, with R = Rx(roll) * Ry(pitch) * Rz(yaw).
 */
export function quaternionToEulerXYZ(q: Quaternion): EulerXYZ {
    const n = normalizeQuaternion(q);
    const { x, y, z, w } = n;

    // Rotation matrix entries needed for the XYZ extraction.
    const m02 = 2 * (x * z + y * w);
    const m12 = 2 * (y * z - x * w);
    const m22 = 1 - 2 * (x * x + y * y);
    const m01 = 2 * (x * y - z * w);
    const m00 = 1 - 2 * (y * y + z * z);
    const m10 = 2 * (x * y + z * w);
    const m11 = 1 - 2 * (x * x + z * z);

    const pitch_rad = Math.asin(Math.min(1, Math.max(-1, m02)));

    // Gimbal lock (|pitch| ~= pi/2): fold everything into roll, report yaw 0.
    if (Math.abs(m02) >= 1) {
        const roll_rad = Math.atan2(m02 > 0 ? m10 : -m10, m11);
        return { roll_rad, pitch_rad, yaw_rad: 0 };
    }

    return {
        roll_rad: Math.atan2(-m12, m22),
        pitch_rad,
        yaw_rad: Math.atan2(-m01, m00),
    };
}

/**
 * Builds the quaternion for R = Rx(roll) * Ry(pitch) * Rz(yaw),
 * matching `RotationAccumulator::setEulerAngles_rad`.
 */
export function eulerXYZToQuaternion(roll_rad: number, pitch_rad: number, yaw_rad: number): Quaternion {
    const cx = Math.cos(roll_rad / 2);
    const sx = Math.sin(roll_rad / 2);
    const cy = Math.cos(pitch_rad / 2);
    const sy = Math.sin(pitch_rad / 2);
    const cz = Math.cos(yaw_rad / 2);
    const sz = Math.sin(yaw_rad / 2);

    // qx = (sx, 0, 0, cx), qy = (0, sy, 0, cy), qz = (0, 0, sz, cz);
    // q = qx * qy * qz (Hamilton product, w last).
    return {
        x: sx * cy * cz + cx * sy * sz,
        y: cx * sy * cz - sx * cy * sz,
        z: cx * cy * sz + sx * sy * cz,
        w: cx * cy * cz - sx * sy * sz,
    };
}
