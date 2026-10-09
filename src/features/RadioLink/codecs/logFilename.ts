/** Firmware StringCodec: one byte of length followed by filename bytes, no NUL. */
export const MAX_LOG_FILENAME_BYTES = 32;

export function encodeLogFilename(filename: string): Uint8Array {
    const bytes = new TextEncoder().encode(filename);
    if (bytes.length === 0 || bytes.length > MAX_LOG_FILENAME_BYTES || bytes.includes(0)) {
        throw new Error("Log filename must contain 1..32 UTF-8 bytes and no NUL characters");
    }
    const payload = new Uint8Array(1 + bytes.length);
    payload[0] = bytes.length;
    payload.set(bytes, 1);
    return payload;
}

export function decodeLogFilename(payload: Uint8Array, offset: number): { filename: string; nextOffset: number } {
    const length = payload[offset];
    const nextOffset = offset + 1 + length;
    if (length === undefined || length === 0 || length > MAX_LOG_FILENAME_BYTES || nextOffset > payload.length) {
        throw new Error("LIST_LOGS response has an invalid filename");
    }
    const bytes = payload.subarray(offset + 1, nextOffset);
    if (bytes.includes(0)) throw new Error("LIST_LOGS response has an invalid filename");
    const filename = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { filename, nextOffset };
}