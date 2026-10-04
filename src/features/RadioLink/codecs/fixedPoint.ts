/**
 * Fixed-point codec mirroring the firmware's
 * `radioLink/requestHandlers/FixedPointCodec.hpp`.
 *
 * Values travel as scaled integers (× `SCALE`, i.e. two decimals) over the
 * radio link. Encoding truncates toward zero like the firmware's
 * `static_cast<int16_t/int32_t>` cast, so both sides agree on negative values.
 */

import { decodeU16, decodeU32, encodeU16, encodeU32 } from "./littleEndian";

/** Scale factor shared with `fixedPoint::kScale` on the firmware. */
export const SCALE = 100;

export const ENCODED_16_SIZE = 2;
export const ENCODED_32_SIZE = 4;

/** Encodes `value` as a little-endian int16 scaled by `SCALE`. */
export function encode16(value: number, buffer: Uint8Array, offset: number): void {
    const scaled = Math.trunc(value * SCALE);
    encodeU16(scaled & 0xffff, buffer, offset);
}

/** Decodes a little-endian int16 from `buffer`, divided by `SCALE`. */
export function decode16(buffer: Uint8Array, offset: number): number {
    const raw = decodeU16(buffer, offset);
    // Reinterpret as signed int16 before scaling back.
    const signed = raw >= 0x8000 ? raw - 0x10000 : raw;
    return signed / SCALE;
}

/** Encodes `value` as a little-endian int32 scaled by `SCALE`. */
export function encode32(value: number, buffer: Uint8Array, offset: number): void {
    const scaled = Math.trunc(value * SCALE);
    encodeU32(scaled >>> 0, buffer, offset);
}

/** Decodes a little-endian int32 from `buffer`, divided by `SCALE`. */
export function decode32(buffer: Uint8Array, offset: number): number {
    const raw = decodeU32(buffer, offset);
    // Reinterpret as signed int32 before scaling back.
    const signed = raw >= 0x80000000 ? raw - 0x100000000 : raw;
    return signed / SCALE;
}
