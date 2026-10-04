/**
 * Little-endian integer codec mirroring the firmware's
 * `radioLink/requestHandlers/LittleEndianCodec.hpp`.
 *
 * All helpers operate on a `Uint8Array` plus byte offset, so call sites read
 * like the firmware (`decodeU16(payload, 1)`) instead of juggling DataViews.
 */

function viewOf(buffer: Uint8Array): DataView {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** Decodes a uint8 from buffer[offset]. */
export function decodeU8(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getUint8(offset);
}

/** Encodes `value` as uint8 into buffer[offset]. */
export function encodeU8(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setUint8(offset, value & 0xff);
}

/** Decodes a little-endian uint16 from buffer[offset..offset+2). */
export function decodeU16(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getUint16(offset, true);
}

/** Encodes `value` as little-endian uint16 into buffer[offset..offset+2). */
export function encodeU16(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setUint16(offset, value & 0xffff, true);
}

/** Decodes a little-endian uint32 from buffer[offset..offset+4). */
export function decodeU32(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getUint32(offset, true);
}

/** Encodes `value` as little-endian uint32 into buffer[offset..offset+4). */
export function encodeU32(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setUint32(offset, value >>> 0, true);
}

/** Decodes a little-endian int16 from buffer[offset..offset+2). */
export function decodeI16(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getInt16(offset, true);
}

/** Encodes `value` as little-endian int16 into buffer[offset..offset+2). */
export function encodeI16(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setInt16(offset, value, true);
}

/** Decodes a little-endian int32 from buffer[offset..offset+4). */
export function decodeI32(buffer: Uint8Array, offset: number): number {
    return viewOf(buffer).getInt32(offset, true);
}

/** Encodes `value` as little-endian int32 into buffer[offset..offset+4). */
export function encodeI32(value: number, buffer: Uint8Array, offset: number): void {
    viewOf(buffer).setInt32(offset, value, true);
}

/**
 * Combines two raw bytes (low first) into a uint16.
 * Handy for streaming parsers that hold low/high in separate variables.
 */
export function combine(low: number, high: number): number {
    return (low & 0xff) | ((high & 0xff) << 8);
}

/** Splits a uint16 into its low byte (e.g. for streaming encoders). */
export function lowByteOf(value: number): number {
    return value & 0xff;
}

/** Splits a uint16 into its high byte (e.g. for streaming encoders). */
export function highByteOf(value: number): number {
    return (value >> 8) & 0xff;
}
