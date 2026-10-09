import test from "node:test";
import assert from "node:assert/strict";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";
import { MessageType, JobStatus, encode, createParser, feed, take } from "../src/features/RadioLink/Protocol.ts";

test("session messages match firmware IDs and exact little-endian layouts", async () => {
    const calls = [];
    const commands = useRadioCommands({ sendMessage: async (type, payload) => {
        calls.push({ type, payload });
        if (type === 0x28) return { status: 0, payload: new Uint8Array([0x78, 0x56, 0x34, 0xf2, 0xf7, 1, 0, 0, 240, 0, 3, 0, 0, 0]) };
        if (type === 0x29) return { status: 0, payload: new Uint8Array([0x78, 0x56, 0x34, 0xf2, 2, 0, 0, 0, 7, 8]) };
        return { status: 0 };
    } });
    assert.equal(MessageType.START_LOG_DOWNLOAD, 0x28);
    assert.equal(MessageType.GET_LOG_CHUNK, 0x29);
    assert.equal(MessageType.STOP_LOG_DOWNLOAD, 0x2a);
    assert.deepEqual(await commands.startLogDownload("é", 0xdeadbeef), {
        sessionId: 0xf2345678, sizeBytes: 503, chunkBytes: 240, chunkCount: 3,
    });
    assert.deepEqual([...calls[0].payload], [2, 0xc3, 0xa9, 0xef, 0xbe, 0xad, 0xde]);
    assert.deepEqual(await commands.getLogChunk(0xf2345678, 2), {
        sessionId: 0xf2345678, index: 2, bytes: new Uint8Array([7, 8]),
    });
    assert.deepEqual([...calls[1].payload], [0x78, 0x56, 0x34, 0xf2, 2, 0, 0, 0]);
    await commands.stopLogDownload(0xf2345678);
    assert.deepEqual([...calls[2].payload], [0x78, 0x56, 0x34, 0xf2]);
    const frame = { messages: calls.map((call, seqId) => ({ ...call, seqId, status: JobStatus.BUSY })) };
    const parser = createParser();
    encode(frame).forEach(byte => feed(parser, byte));
    assert.deepEqual(take(parser), frame);
});

test("malformed session responses and invalid client inputs reject", async () => {
    const mock = payload => useRadioCommands({ sendMessage: async () => ({ status: 0, payload }) });
    for (const payload of [undefined, new Uint8Array(13), new Uint8Array(15), new Uint8Array(14)]) {
        await assert.rejects(mock(payload).startLogDownload("f", 1), /invalid/);
    }
    for (const payload of [new Uint8Array([1, 0, 0, 0, 1, 0, 0, 0, 9]), new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 9])]) {
        await assert.rejects(mock(payload).getLogChunk(1, 0), /invalid/);
    }
    await assert.rejects(mock(new Uint8Array([1])).stopLogDownload(1), /invalid/);
    let sends = 0;
    const commands = useRadioCommands({ sendMessage: async () => { sends++; return { status: 0 }; } });
    for (const value of [-1, 0x100000000, 0.5, NaN]) {
        await assert.rejects(commands.startLogDownload("f", value), /token/);
        await assert.rejects(commands.getLogChunk(1, value), /index/);
        await assert.rejects(commands.getLogChunk(value, 0), /session/);
    }
    await assert.rejects(commands.getLogChunk(0, 0), /nonzero/);
    assert.equal(sends, 0);
});