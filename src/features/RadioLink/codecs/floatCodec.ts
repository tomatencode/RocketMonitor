/**
 * Raw little-endian float codec for the radio link.
 *
 * Most telemetry uses the scaled-integer {@link ./fixedPoint.ts} codec, but
 * some payloads may carry native IEEE-754 floats — these helpers keep those
 * call sites consistent (explicit offset + little-endian) instead of each
 * one reaching for `DataView` directly.
 */

function viewOf(buffer: Uint8Array): DataView {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** Wire size of a 32-bit float in bytes. */
export const ENCODED_F32_SIZE = 4;
/** Wire size of a 64-bit float in bytes. */
export const ENCODED_F64_SIZE = 8;

/** Encodes `value` as a little-endian float32 into buffer[offset..offset+4). */
export function encodeFloat32(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setFloat32(offset, value, true);
}

/** Decodes a little-endian float32 from buffer[offset..offset+4). */
export function decodeFloat32(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getFloat32(offset, true);
}

/** Encodes `value` as a little-endian float64 into buffer[offset..offset+8). */
export function encodeFloat64(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setFloat64(offset, value, true);
}

/** Decodes a little-endian float64 from buffer[offset..offset+8). */
export function decodeFloat64(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getFloat64(offset, true);
}
