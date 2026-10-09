import type { RocketLogDownloadTransport, LogDownloadSession } from "../RocketStatus/rocketTypes";

/** Fit both request count and full responses in a single 1024-byte firmware frame. */
export function logDownloadBatchSize(chunkBytes: number): number {
    return Math.min(16, Math.floor((1024 - 6) / (4 + 8 + chunkBytes)));
}

/** Issue each batch synchronously so the transport's microtask combines its requests. */
export async function downloadLog(reader: Pick<RocketLogDownloadTransport, "getLogChunk">, session: LogDownloadSession, signal: AbortSignal,
    onProgress: (received: number, total: number) => void): Promise<Uint8Array> {
    signal.throwIfAborted();
    const { sessionId, sizeBytes, chunkBytes, chunkCount } = session;
    if (!Number.isInteger(sessionId) || sessionId < 1 || sessionId > 0xffffffff ||
        !Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 0xffffffff ||
        !Number.isInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 240 ||
        !Number.isInteger(chunkCount) || chunkCount !== Math.ceil(sizeBytes / chunkBytes)) {
        throw new Error("Invalid download session size, chunk limit or count");
    }
    const bytes = new Uint8Array(sizeBytes);
    let offset = 0;
    onProgress(0, sizeBytes);
    const batchSize = logDownloadBatchSize(chunkBytes);
    while (offset < sizeBytes) {
        signal.throwIfAborted();
        const requests: { index: number; offset: number; length: number }[] = [];
        let nextOffset = offset;
        while (requests.length < batchSize && nextOffset < sizeBytes) {
            const length = Math.min(chunkBytes, sizeBytes - nextOffset);
            requests.push({ index: nextOffset / chunkBytes, offset: nextOffset, length });
            nextOffset += length;
        }
        // Drain failures too: don't resume polling while other chunk requests/retries are pending.
        const results = await Promise.allSettled(requests.map(async request =>
            reader.getLogChunk(sessionId, request.index)));
        signal.throwIfAborted();
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === "rejected") throw result.reason;
            const chunk = result.value;
            const request = requests[i];
            // START supplied verified geometry; no shortening except the final chunk.
            if (chunk.sessionId !== sessionId || chunk.index !== request.index || chunk.bytes.length !== request.length) {
                throw new Error("Invalid or incomplete log chunk; no file was saved");
            }
            bytes.set(chunk.bytes, request.offset);
            offset += chunk.bytes.length;
            onProgress(offset, sizeBytes);
        }
    }
    return bytes;
}