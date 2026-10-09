/** Adapt byte-oriented test fixtures to the session wire contract, not production fallback. */
export function sessionTransport(reader, hooks = {}) {
    let info;
    const sessionId = 17;
    return {
        startLogDownload: async (filename, token) => {
            hooks.start?.(filename, token);
            info = await reader.getLogInfo(filename);
            return { sessionId, sizeBytes: info.sizeBytes, chunkBytes: info.maxChunkBytes,
                chunkCount: Math.ceil(info.sizeBytes / info.maxChunkBytes) };
        },
        getLogChunk: async (session, index) => {
            const offset = index * info.maxChunkBytes;
            const chunk = await reader.getLogBytes("f", offset, Math.min(info.maxChunkBytes, info.sizeBytes - offset));
            return { sessionId: session, index: chunk.offset / info.maxChunkBytes, bytes: chunk.bytes };
        },
        stopLogDownload: async session => { hooks.stop?.(session); },
    };
}