import test from "node:test";
import assert from "node:assert/strict";
import { RocketLogDownloader } from "../src/features/RocketLogDownloader/RocketLogDownloader.ts";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { DownloadTrafficGate } from "../src/features/RadioLink/DownloadTrafficGate.ts";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";
import { MessageType, JobStatus, encode, createParser, feed, take } from "../src/features/RadioLink/Protocol.ts";

const session = { sessionId: 42, sizeBytes: 3, chunkBytes: 240, chunkCount: 1 };
function setup(t, transport) {
    const store = new RocketStatusStore(() => ({}));
    store.setConnected(true);
    t.after(() => store.suspend());
    const gate = new DownloadTrafficGate();
    const downloader = new RocketLogDownloader(() => transport, store, gate, async () => {});
    return { store, gate, downloader };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("success waits for STOP acknowledgment before returning bytes or releasing traffic", async t => {
    let finishStop;
    const calls = [];
    const { downloader, gate } = setup(t, {
        startLogDownload: async (filename, token) => { calls.push([filename, token]); return session; },
        getLogChunk: async (sessionId, index) => ({ sessionId, index, bytes: new Uint8Array([1, 2, 3]) }),
        stopLogDownload: id => { calls.push(id); return new Promise(resolve => { finishStop = resolve; }); },
    });
    const transfer = downloader.startDownload("f");
    await tick();
    assert.equal(downloader.getProgress().received, 3);
    assert.equal(downloader.isRunning(), true);
    assert.equal(gate.isDownloading(), true);
    assert.equal(calls[1], 42);
    finishStop();
    assert.deepEqual(await transfer, new Uint8Array([1, 2, 3]));
    assert.equal(downloader.getProgress().state, "completed");
    assert.equal(gate.isDownloading(), false);
});

test("cancel during START closes the late-created session without requesting chunks", async t => {
    let finishStart;
    const stops = [];
    const { downloader } = setup(t, {
        startLogDownload: () => new Promise(resolve => { finishStart = resolve; }),
        getLogChunk: async () => { throw Error("must not send chunks"); },
        stopLogDownload: async id => { stops.push(id); },
    });
    const outcome = downloader.startDownload("f").catch(error => error);
    await tick();
    downloader.stopDownload();
    finishStart(session);
    assert.equal((await outcome).name, "AbortError");
    assert.deepEqual(stops, [42]);
});

test("bad session geometry still closes the session and returns no partial data", async t => {
    const stops = [];
    let current;
    const { downloader } = setup(t, {
        startLogDownload: async () => current,
        getLogChunk: async () => { throw Error("must not request chunks"); },
        stopLogDownload: async id => { stops.push(id); },
    });
    for (const invalid of [{ ...session, chunkCount: 2 }, { ...session, chunkBytes: 0 },
        { ...session, chunkBytes: 241 }, { ...session, sizeBytes: -1 }]) {
        current = invalid;
        await assert.rejects(downloader.startDownload("f"), /Invalid/);
    }
    assert.deepEqual(stops, [42, 42, 42, 42]);
});

test("failed STOP reports remote-session timeout and releases local leases", async t => {
    const { downloader, gate } = setup(t, {
        startLogDownload: async () => session,
        getLogChunk: async (sessionId, index) => ({ sessionId, index, bytes: new Uint8Array(3) }),
        stopLogDownload: async () => { throw Error("STOP rejected"); },
    });
    await assert.rejects(downloader.startDownload("f"), /60-second timeout/);
    assert.equal(downloader.getProgress().state, "failed");
    assert.match(downloader.getProgress().error, /STOP rejected/);
    assert.equal(gate.isDownloading(), false);
});

test("chunk failure drains other requests before STOP and preserves original error", async t => {
    let finishChunk;
    let stopped = false;
    const { downloader } = setup(t, {
        startLogDownload: async () => ({ ...session, sizeBytes: 480, chunkCount: 2 }),
        getLogChunk: (sessionId, index) => index === 0 ? Promise.reject(Error("chunk failure"))
            : new Promise(resolve => { finishChunk = () => resolve({ sessionId, index, bytes: new Uint8Array(240) }); }),
        stopLogDownload: async () => { stopped = true; },
    });
    const outcome = downloader.startDownload("f").catch(error => error);
    await tick();
    assert.equal(stopped, false);
    finishChunk();
    assert.match((await outcome).message, /chunk failure/);
    assert.equal(stopped, true);
});

test("disconnect skips STOP to avoid sending an old session to a new connection", async t => {
    let finishStart;
    let stopped = false;
    const { downloader, store } = setup(t, {
        startLogDownload: () => new Promise(resolve => { finishStart = resolve; }),
        stopLogDownload: async () => { stopped = true; },
    });
    const outcome = downloader.startDownload("f").catch(error => error);
    await tick();
    store.setConnected(false); store.setConnected(true);
    finishStart(session);
    assert.match((await outcome).message, /connection changed/);
    assert.equal(stopped, false);
    assert.equal(downloader.getProgress().state, "cancelled");
});

test("end-to-end framed session transfer uses only new messages, exact indices, unique tokens, and STOP at EOF", async t => {
    const original = Uint8Array.from({ length: 1100 }, (_, i) => i % 256);
    const calls = [];
    const tokens = [];
    let active = false;
    const commands = useRadioCommands({ sendMessage: async (type, payload) => {
        // Encode and parse both directions using the actual frame format.
        const parser = createParser();
        encode({ messages: [{ type, payload, seqId: 7, status: JobStatus.BUSY }] }).forEach(byte => feed(parser, byte));
        const request = take(parser).messages[0];
        calls.push(type);
        const input = new DataView(request.payload.buffer, request.payload.byteOffset, request.payload.byteLength);
        let response;
        if (type === MessageType.START_LOG_DOWNLOAD) {
            assert.equal(active, false);
            active = true;
            tokens.push(input.getUint32(2, true)); // StringCodec("f") takes two bytes.
            response = new Uint8Array(14);
            const view = new DataView(response.buffer);
            view.setUint32(0, 42, true); view.setUint32(4, original.length, true);
            view.setUint16(8, 240, true); view.setUint32(10, 5, true);
        } else if (type === MessageType.GET_LOG_CHUNK) {
            assert.equal(active, true);
            assert.equal(input.getUint32(0, true), 42);
            const index = input.getUint32(4, true);
            assert.ok(index < 5);
            const bytes = original.slice(index * 240, (index + 1) * 240);
            response = new Uint8Array(8 + bytes.length);
            response.set(request.payload); response.set(bytes, 8);
        } else {
            assert.equal(type, MessageType.STOP_LOG_DOWNLOAD);
            assert.equal(input.getUint32(0, true), 42);
            active = false; response = new Uint8Array();
        }
        encode({ messages: [{ type, payload: response, seqId: 7, status: JobStatus.SUCCESS }] }).forEach(byte => feed(parser, byte));
        return { status: 0, payload: take(parser).messages[0].payload };
    } });
    const { downloader } = setup(t, commands);
    assert.deepEqual(await downloader.startDownload("f"), original);
    assert.equal(active, false);
    assert.deepEqual(calls, [0x28, 0x29, 0x29, 0x29, 0x29, 0x29, 0x2a]);
    await downloader.startDownload("f");
    assert.notEqual(tokens[0], tokens[1]);
});