import type { RocketLogReader, LogMetadata, Quaternion, PIDParameters } from "../../../RocketStatus/rocketTypes";

export type LogDeletion = { filename: string } | { all: true };
export interface LogDeleteConfirmation {
    deletion: LogDeletion;
    expiresAt: number;
}

/** A second press only confirms the same target within the five-second window. */
export function isLogDeleteConfirmed(pending: LogDeleteConfirmation | null, deletion: LogDeletion, now = Date.now()): boolean {
    if (!pending || now >= pending.expiresAt) return false;
    return "all" in deletion ? "all" in pending.deletion
        : "filename" in pending.deletion && pending.deletion.filename === deletion.filename;
}

export function createLogFilename(now = new Date()): string {
    return `testlog-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
}

export function createLogMetadata(rotation: Quaternion | null, target: Quaternion | null,
    parameters: PIDParameters | null, height: number | null, now = Date.now()): LogMetadata {
    const initialRotation = rotation ?? { x: 0, y: 0, z: 0, w: 1 };
    return {
        timestamp_unix: Math.floor(now / 1000), initialRotation,
        targetAngle: target ?? initialRotation,
        pidKp: parameters?.kp ?? 0, pidKi: parameters?.ki ?? 0, pidKd: parameters?.kd ?? 0,
        initialHeight_m: height ?? 0,
    };
}

export async function listAllLogs(reader: RocketLogReader, signal: AbortSignal): Promise<string[]> {
    const filenames: string[] = [];
    let index = 0;
    let total: number | undefined;
    do {
        signal.throwIfAborted();
        const page = await reader.listLogs(index);
        signal.throwIfAborted();
        if (!Number.isInteger(page.totalFiles) || page.totalFiles < 0 || page.totalFiles > 255 ||
            page.nextIndex !== index + page.filenames.length || page.nextIndex > page.totalFiles ||
            (page.nextIndex === index && page.nextIndex !== page.totalFiles)) {
            throw new Error("Invalid log-list pagination");
        }
        if (total !== undefined && page.totalFiles !== total) throw new Error("Log list changed; refresh and try again");
        total = page.totalFiles;
        filenames.push(...page.filenames);
        index = page.nextIndex;
    } while (index < total);
    return filenames;
}

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
        const results = await Promise.allSettled(requests.map(request =>
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