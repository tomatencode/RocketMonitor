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
 * The firmware builds its attitude as R = Rx * Ry * Rz (see
 * `RotationAccumulator::setEulerAngles_rad`). Three.js consumes Euler triples
 * in its default 'XYZ' order, which produces the same matrix. These helpers
 * deliberately use axis names rather than flight-axis labels: firmware defines
 * X as yaw, Y as pitch, and Z as roll.
 */

/** Returns a unit-length copy of `q` (identity when `q` has zero length). */
export function normalizeQuaternion(q: Quaternion): Quaternion {
    const norm = Math.hypot(q.x, q.y, q.z, q.w);
    if (!(norm > 0)) return { x: 0, y: 0, z: 0, w: 1 };
    return { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm };
}

export interface EulerXYZ {
    x_rad: number;
    y_rad: number;
    z_rad: number;
}

/**
 * Converts a (possibly unnormalised, e.g. fixed-point x100 wire) quaternion
 * to XYZ-Euler angles in radians, with R = Rx * Ry * Rz.
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

    // Gimbal lock (|Y| ~= pi/2): fold everything into X, report Z as 0.
    if (Math.abs(m02) >= 1) {
        const x_rad = Math.atan2(m02 > 0 ? m10 : -m10, m11);
        return { x_rad, y_rad: pitch_rad, z_rad: 0 };
    }

    return {
        x_rad: Math.atan2(-m12, m22),
        y_rad: pitch_rad,
        z_rad: Math.atan2(-m01, m00),
    };
}

/**
 * Builds the quaternion for R = Rx * Ry * Rz,
 * matching `RotationAccumulator::setEulerAngles_rad`.
 */
export function eulerXYZToQuaternion(x_rad: number, y_rad: number, z_rad: number): Quaternion {
    const cx = Math.cos(x_rad / 2);
    const sx = Math.sin(x_rad / 2);
    const cy = Math.cos(y_rad / 2);
    const sy = Math.sin(y_rad / 2);
    const cz = Math.cos(z_rad / 2);
    const sz = Math.sin(z_rad / 2);

    // qx = (sx, 0, 0, cx), qy = (0, sy, 0, cy), qz = (0, 0, sz, cz);
    // q = qx * qy * qz (Hamilton product, w last).
    return {
        x: sx * cy * cz + cx * sy * sz,
        y: cx * sy * cz - sx * cy * sz,
        z: cx * cy * sz + sx * sy * cz,
        w: cx * cy * cz - sx * sy * sz,
    };
}
