import test from "node:test";
import assert from "node:assert/strict";
import { createLogFilename, createLogMetadata, listAllLogs, downloadLog, logDownloadBatchSize } from "../src/features/Panels/ControlPanels/LoggingPanel/logOperations.ts";

test("recording names fit firmware limits and metadata uses current status", () => {
    const date = new Date("2026-10-09T12:34:56.789Z");
    const name = createLogFilename(date);
    assert.equal(name, "testlog-20261009T123456Z");
    assert.ok(new TextEncoder().encode(name).length <= 32);
    const rotation = { x: 0, y: 0.1, z: 0, w: 1 };
    const target = { x: 0.2, y: 0, z: 0, w: 1 };
    assert.deepEqual(createLogMetadata(rotation, target, { kp: 1, ki: 2, kd: 3 }, 4, date.getTime()), {
        timestamp_unix: Math.floor(date.getTime() / 1000), initialRotation: rotation,
        targetAngle: target, pidKp: 1, pidKi: 2, pidKd: 3, initialHeight_m: 4,
    });
    const fallback = createLogMetadata(null, null, null, null, 0);
    assert.deepEqual(fallback.initialRotation, { x: 0, y: 0, z: 0, w: 1 });
    assert.equal(fallback.targetAngle, fallback.initialRotation);
    assert.equal(fallback.pidKp, 0);
    assert.equal(fallback.initialHeight_m, 0);
});

test("all log pages are loaded in order, including empty storage", async () => {
    const calls = [];
    const reader = { listLogs: async index => {
        calls.push(index);
        return index === 0 ? { totalFiles: 3, nextIndex: 2, filenames: ["one", "two"] }
            : { totalFiles: 3, nextIndex: 3, filenames: ["three"] };
    } };
    assert.deepEqual(await listAllLogs(reader, new AbortController().signal), ["one", "two", "three"]);
    assert.deepEqual(calls, [0, 2]);
    assert.deepEqual(await listAllLogs({ listLogs: async () => ({ totalFiles: 0, nextIndex: 0, filenames: [] }) },
        new AbortController().signal), []);
});

test("malformed or changing pagination fails instead of returning a partial list", async () => {
    for (const page of [{ totalFiles: 1, nextIndex: 0, filenames: [] },
        { totalFiles: 1, nextIndex: 2, filenames: ["a", "b"] },
        { totalFiles: -1, nextIndex: 0, filenames: [] }]) {
        await assert.rejects(listAllLogs({ listLogs: async () => page }, new AbortController().signal));
    }
    await assert.rejects(listAllLogs({ listLogs: async index => index === 0
        ? { totalFiles: 2, nextIndex: 1, filenames: ["a"] }
        : { totalFiles: 3, nextIndex: 2, filenames: ["b"] } }, new AbortController().signal), /changed/);
});

test("download concatenates exact raw bytes with progress and final short chunk", async () => {
    const original = Uint8Array.from({ length: 503 }, (_, i) => i % 256);
    const calls = [];
    const progress = [];
    const reader = {
        getLogInfo: async name => { assert.equal(name, "f"); return { sizeBytes: original.length, maxChunkBytes: 240 }; },
        getLogBytes: async (name, offset, length) => {
            assert.equal(name, "f");
            await Promise.resolve();
            calls.push([offset, length]);
            return { offset, bytes: original.slice(offset, offset + length) };
        },
    };
    const bytes = await downloadLog(reader, "f", new AbortController().signal, (...p) => progress.push(p));
    assert.deepEqual(bytes, original);
    assert.deepEqual(calls, [[0, 240], [240, 240], [480, 23]]);
    assert.deepEqual(progress, [[0, 503], [240, 503], [480, 503], [503, 503]]);
});

test("empty file completes without byte requests and respects advertised chunk limit", async () => {
    const empty = await downloadLog({ getLogInfo: async () => ({ sizeBytes: 0, maxChunkBytes: 10 }),
        getLogBytes: async () => { throw Error("should not run"); } }, "f", new AbortController().signal, () => {});
    assert.equal(empty.length, 0);
    const offsets = [];
    await downloadLog({ getLogInfo: async () => ({ sizeBytes: 5, maxChunkBytes: 3 }),
        getLogBytes: async (_, offset, length) => {
            offsets.push([offset, length]);
            return { offset, bytes: new Uint8Array(length) };
        } }, "f", new AbortController().signal, () => {});
    assert.deepEqual(offsets, [[0, 3], [3, 2]]);
});

test("empty, oversized, wrong-offset, or failed chunks never return a partial file", async () => {
    for (const chunk of [{ offset: 0, bytes: new Uint8Array() },
        { offset: 1, bytes: new Uint8Array(1) }, { offset: 0, bytes: new Uint8Array(3) }]) {
        await assert.rejects(downloadLog({ getLogInfo: async () => ({ sizeBytes: 2, maxChunkBytes: 2 }),
            getLogBytes: async () => chunk }, "f", new AbortController().signal, () => {}), /incomplete/);
    }
    await assert.rejects(downloadLog({ getLogInfo: async () => ({ sizeBytes: 2, maxChunkBytes: 1 }),
        getLogBytes: async (_, offset) => {
            if (offset > 0) throw Error("radio lost");
            return { offset, bytes: new Uint8Array([1]) };
        } }, "f", new AbortController().signal, () => {}), /radio lost/);
});

test("cancellation checks prevent further requests or saving after an in-flight response", async () => {
    const controller = new AbortController();
    let requests = 0;
    const reader = { getLogInfo: async () => ({ sizeBytes: 2, maxChunkBytes: 1 }),
        getLogBytes: async (_, offset) => {
            requests++;
            controller.abort();
            return { offset, bytes: new Uint8Array([1]) };
        } };
    await assert.rejects(downloadLog(reader, "f", controller.signal, () => {}), { name: "AbortError" });
    assert.equal(requests, 2); // The complete batch was issued before awaiting responses.
    await assert.rejects(listAllLogs({ listLogs: async () => { throw Error("should not run"); } }, controller.signal),
        { name: "AbortError" });
});

test("batch size keeps responses under 1024 bytes and requests under 16 messages", () => {
    assert.equal(logDownloadBatchSize(240), 4);
    assert.equal(logDownloadBatchSize(1), 16);
    for (let chunk = 1; chunk <= 240; chunk++) {
        const count = logDownloadBatchSize(chunk);
        assert.ok(count <= 16);
        assert.ok(6 + count * (8 + chunk) <= 1024);
        // Largest filename: each GET_LOG_BYTES request occupies 4 + 33 + 6 bytes.
        assert.ok(6 + count * 43 <= 1024);
    }
});

test("four requests share one tick and out-of-order responses assemble by offset", async () => {
    const original = Uint8Array.from({ length: 1100 }, (_, i) => i % 256);
    let batch = [];
    const batches = [];
    const pending = [];
    const reader = {
        getLogInfo: async () => ({ sizeBytes: original.length, maxChunkBytes: 240 }),
        getLogBytes: (_, offset, length) => new Promise(resolve => {
            batch.push(offset);
            pending.push(() => resolve({ offset, bytes: original.slice(offset, offset + length) }));
            if (batch.length === 1) queueMicrotask(() => {
                batches.push(batch);
                batch = [];
                pending.splice(0).reverse().forEach(finish => finish());
            });
        }),
    };
    assert.deepEqual(await downloadLog(reader, "f", new AbortController().signal, () => {}), original);
    assert.deepEqual(batches, [[0, 240, 480, 720], [960]]);
});

test("failed batch waits for other responses before rejecting", async () => {
    let resolve;
    let finished = false;
    const operation = downloadLog({ getLogInfo: async () => ({ sizeBytes: 480, maxChunkBytes: 240 }),
        getLogBytes: (_, offset) => offset === 0 ? Promise.reject(Error("failed chunk"))
            : new Promise(r => { resolve = r; }) }, "f", new AbortController().signal, () => {});
    const result = operation.catch(error => { finished = true; return error; });
    await new Promise(r => setImmediate(r));
    assert.equal(finished, false);
    resolve({ offset: 240, bytes: new Uint8Array(240) });
    assert.match((await result).message, /failed chunk/);
});