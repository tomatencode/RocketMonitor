import type { RocketLogReader } from "../RocketStatus/rocketTypes";

/** Fit both request count and full responses in a single 1024-byte firmware frame. */
export function logDownloadBatchSize(chunkBytes: number): number {
    return Math.min(16, Math.floor((1024 - 6) / (4 + 4 + chunkBytes)));
}

/** Issue each batch synchronously so the transport's microtask combines its requests. */
export async function downloadLog(reader: RocketLogReader, filename: string, signal: AbortSignal,
    onProgress: (received: number, total: number) => void): Promise<Uint8Array> {
    signal.throwIfAborted();
    const { sizeBytes, maxChunkBytes } = await reader.getLogInfo(filename);
    signal.throwIfAborted();
    if (!Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 0xffffffff ||
        !Number.isInteger(maxChunkBytes) || maxChunkBytes < 1 || maxChunkBytes > 240) {
        throw new Error("Invalid log size or chunk limit");
    }
    const bytes = new Uint8Array(sizeBytes);
    let offset = 0;
    onProgress(0, sizeBytes);
    const batchSize = logDownloadBatchSize(maxChunkBytes);
    while (offset < sizeBytes) {
        signal.throwIfAborted();
        const requests: { offset: number; length: number }[] = [];
        let nextOffset = offset;
        while (requests.length < batchSize && nextOffset < sizeBytes) {
            const length = Math.min(maxChunkBytes, sizeBytes - nextOffset);
            requests.push({ offset: nextOffset, length });
            nextOffset += length;
        }
        // Drain failures too: don't resume polling while other chunk requests/retries are pending.
        const results = await Promise.allSettled(requests.map(async request =>
            reader.getLogBytes(filename, request.offset, request.length)));
        signal.throwIfAborted();
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === "rejected") throw result.reason;
            const chunk = result.value;
            const request = requests[i];
            // GET_LOG_INFO supplied verified size, so EOF shortening before that size is corruption.
            if (chunk.offset !== request.offset || chunk.bytes.length !== request.length) {
                throw new Error("Invalid or incomplete log chunk; no file was saved");
            }
            bytes.set(chunk.bytes, chunk.offset);
            offset += chunk.bytes.length;
            onProgress(offset, sizeBytes);
        }
    }
    return bytes;
}