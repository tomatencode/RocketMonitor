import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";
import { MessageType, JobStatus, encode, createParser, feed, take } from "../src/features/RadioLink/Protocol.ts";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";

const metadata = {
    timestamp_unix: 0x12345678,
    initialRotation: { x: 0, y: 0, z: 0, w: 1 },
    targetAngle: { x: -0.5, y: 0.5, z: 0, w: 1 },
    pidKp: 1.25, pidKi: -2.5, pidKd: 0.75, initialHeight_m: -10.25,
};
const success = payload => ({ status: 0, payload });
function mock(response) {
    const calls = [];
    const commands = useRadioCommands({ sendMessage: async (type, payload) => {
        calls.push({ type, payload });
        return typeof response === "function" ? response(type, payload) : response;
    } });
    return { commands, calls };
}
function nameBytes(name) {
    const bytes = new TextEncoder().encode(name);
    return [bytes.length, ...bytes];
}

test("firmware log message IDs match and survive framing", () => {
    const names = ["START_LOG", "FINISH_LOG", "IS_LOGGING", "LIST_LOGS", "GET_LOG_INFO", "GET_LOG_BYTES"];
    const parser = createParser();
    const messages = names.map((name, i) => {
        assert.equal(MessageType[name], 0x20 + i);
        return { type: MessageType[name], seqId: i, status: JobStatus.SUCCESS, payload: new Uint8Array([i]) };
    });
    encode({ messages }).forEach(byte => feed(parser, byte));
    assert.deepEqual(take(parser), { messages });
});

test("START_LOG uses the exact 52-byte metadata layout and byte-prefixed filename", async () => {
    const { commands, calls } = mock(success());
    await commands.startLog("flight.bin", metadata);
    const { type, payload } = calls[0];
    assert.equal(type, MessageType.START_LOG);
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint32(0, true), metadata.timestamp_unix);
    const fixed = [0, 0, 0, 100, -50, 50, 0, 100, 125, -250, 75, -1025];
    fixed.forEach((value, i) => assert.equal(view.getInt32(4 + i * 4, true), value));
    assert.deepEqual([...payload.slice(52)], nameBytes("flight.bin"));
    assert.equal(payload.length, 52 + 1 + 10);
});

test("FINISH_LOG and IS_LOGGING send empty requests and report booleans", async () => {
    const { commands, calls } = mock(type => success(type === MessageType.IS_LOGGING ? new Uint8Array([1]) : undefined));
    await commands.finishLog();
    assert.equal(await commands.isLogging(), true);
    assert.equal(await commands.getLogging(), true);
    assert.deepEqual(calls.map(c => c.type), [MessageType.FINISH_LOG, MessageType.IS_LOGGING, MessageType.IS_LOGGING]);
    assert.ok(calls.every(c => c.payload === undefined));
    assert.equal(await mock(success(new Uint8Array([0]))).commands.isLogging(), false);
});

test("LIST_LOGS decodes pages, Unicode filenames, and terminal empty pages", async () => {
    const { commands, calls } = mock(success(new Uint8Array([3, 2, 2, ...nameBytes("one"), ...nameBytes("é")] )));
    assert.deepEqual(await commands.listLogs(), { totalFiles: 3, nextIndex: 2, filenames: ["one", "é"] });
    assert.deepEqual([...calls[0].payload], [0]);
    const last = mock(success(new Uint8Array([3, 3, 1, ...nameBytes("last")])));
    assert.deepEqual(await last.commands.listLogs(2), { totalFiles: 3, nextIndex: 3, filenames: ["last"] });
    assert.deepEqual([...last.calls[0].payload], [2]);
    assert.deepEqual(await mock(success(new Uint8Array([0, 0, 0]))).commands.listLogs(),
        { totalFiles: 0, nextIndex: 0, filenames: [] });
    assert.deepEqual(await mock(success(new Uint8Array([3, 3, 0]))).commands.listLogs(3),
        { totalFiles: 3, nextIndex: 3, filenames: [] });
});

test("GET_LOG_INFO encodes filename and decodes unsigned size and chunk limit", async () => {
    const payload = new Uint8Array([0x78, 0x56, 0x34, 0xf2, 240, 0]);
    const { commands, calls } = mock(success(payload));
    assert.deepEqual(await commands.getLogInfo("flight"), { sizeBytes: 0xf2345678, maxChunkBytes: 240 });
    assert.equal(calls[0].type, MessageType.GET_LOG_INFO);
    assert.deepEqual([...calls[0].payload], nameBytes("flight"));
});

test("GET_LOG_BYTES encodes unsigned offset/length, accepts short chunks and EOF", async () => {
    const { commands, calls } = mock(success(new Uint8Array([0x78, 0x56, 0x34, 0xf2, 1, 2, 3])));
    assert.deepEqual(await commands.getLogBytes("f", 0xf2345678, 240),
        { offset: 0xf2345678, bytes: new Uint8Array([1, 2, 3]) });
    assert.equal(calls[0].type, MessageType.GET_LOG_BYTES);
    assert.deepEqual([...calls[0].payload], [1, 102, 0x78, 0x56, 0x34, 0xf2, 240, 0]);
    assert.deepEqual(await mock(success(new Uint8Array([10, 0, 0, 0]))).commands.getLogBytes("f", 10, 1),
        { offset: 10, bytes: new Uint8Array() });
});

test("all six handlers surface firmware rejection", async () => {
    const { commands } = mock({ status: 1 });
    for (const [name, args] of [
        ["startLog", ["f", metadata]], ["finishLog", []], ["isLogging", []],
        ["listLogs", []], ["getLogInfo", ["f"]], ["getLogBytes", ["f", 0, 1]],
    ]) await assert.rejects(commands[name](...args), /was rejected/, name);
});

test("invalid filenames and numeric ranges fail before sending", async () => {
    const { commands, calls } = mock(success());
    for (const filename of ["", "a".repeat(33), "é".repeat(17), "a\0b"]) {
        await assert.rejects(commands.startLog(filename, metadata), /filename/);
        await assert.rejects(commands.getLogInfo(filename), /filename/);
        await assert.rejects(commands.getLogBytes(filename, 0, 1), /filename/);
    }
    for (const start of [-1, 256, 1.5, NaN]) await assert.rejects(commands.listLogs(start), /index/);
    for (const offset of [-1, 0x100000000, 0.5]) await assert.rejects(commands.getLogBytes("f", offset, 1), /offset/);
    for (const length of [0, -1, 241, 1.5]) await assert.rejects(commands.getLogBytes("f", 0, length), /length/);
    await assert.rejects(commands.startLog("f", { ...metadata, timestamp_unix: -1 }), /timestamp/);
    await assert.rejects(commands.startLog("f", { ...metadata, pidKp: Infinity }), /fixed-point/);
    assert.equal(calls.length, 0);
});

test("filename limits are measured in UTF-8 bytes, not JS characters", async () => {
    const { commands, calls } = mock(success());
    await commands.startLog("é".repeat(16), metadata);
    assert.equal(calls[0].payload[52], 32);
    assert.equal(calls[0].payload.length, 85);
});

test("malformed boolean and info responses are rejected", async () => {
    for (const payload of [undefined, new Uint8Array(), new Uint8Array([2]), new Uint8Array([1, 0])]) {
        await assert.rejects(mock(success(payload)).commands.isLogging(), /invalid/);
    }
    for (const payload of [undefined, new Uint8Array(5), new Uint8Array(7),
        new Uint8Array(6), new Uint8Array([0, 0, 0, 0, 241, 0])]) {
        await assert.rejects(mock(success(payload)).commands.getLogInfo("f"), /invalid/);
    }
});

test("malformed list pages cannot truncate silently or loop forever", async () => {
    for (const payload of [
        [], [1, 0], [1, 0, 0], [1, 2, 1], [1, 1, 0], [1, 1, 1],
        [1, 1, 1, 0], [1, 1, 1, 2, 65], [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 65, 99], [1, 1, 1, 33, ...Array(33).fill(65)],
        [1, 1, 1, 1, 0xff],
    ]) await assert.rejects(mock(success(new Uint8Array(payload))).commands.listLogs());
});

test("invalid chunk headers, mismatched offsets and oversized replies reject", async () => {
    for (const payload of [undefined, new Uint8Array(3), new Uint8Array([1, 0, 0, 0]), new Uint8Array(6)]) {
        await assert.rejects(mock(success(payload)).commands.getLogBytes("f", 0, 1), /invalid/);
    }
});

test("commander start/finish refresh shared logging state without recurring polls", async t => {
    let logging = false;
    let reads = 0;
    const store = new RocketStatusStore(() => ({ logging: async () => { reads++; return logging; } }));
    store.setConnected(true);
    t.after(() => store.suspend());
    store.subscribe("logging", () => {});
    await delay(10);
    const forwarded = [];
    const commander = new RocketCommander(() => ({
        startLog: async (...args) => { forwarded.push(args); logging = true; },
        finishLog: async () => { logging = false; },
    }), store);
    await commander.startLog("f", metadata);
    await delay(10);
    assert.equal(store.getSnapshot("logging").value, true);
    assert.deepEqual(forwarded, [["f", metadata]]);
    await commander.finishLog();
    await delay(10);
    assert.equal(store.getSnapshot("logging").value, false);
    assert.equal(reads, 3);
});

test("on-demand log reads are accessible without a radio import and reject stale sessions", async t => {
    const store = new RocketStatusStore(() => ({}));
    store.setConnected(true);
    t.after(() => store.suspend());
    const calls = [];
    let finish;
    const reader = {
        listLogs: async index => { calls.push(index); return { totalFiles: 0, nextIndex: 0, filenames: [] }; },
        getLogInfo: async filename => { calls.push(filename); return { sizeBytes: 0, maxChunkBytes: 240 }; },
        getLogBytes: () => new Promise(resolve => { finish = resolve; }),
    };
    const commander = new RocketCommander(() => ({}), store, () => reader);
    await commander.listLogs(2);
    await commander.getLogInfo("f");
    assert.deepEqual(calls, [2, "f"]);
    const pending = commander.getLogBytes("f", 0, 1);
    store.setConnected(false);
    finish({ offset: 0, bytes: new Uint8Array() });
    await assert.rejects(pending, /connection changed/);
    await assert.rejects(commander.listLogs(), /not connected/);
});