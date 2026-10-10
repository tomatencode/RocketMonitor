import type { RocketLogReader } from "../../../RocketStatus/rocketTypes";

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
    return `test-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
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
