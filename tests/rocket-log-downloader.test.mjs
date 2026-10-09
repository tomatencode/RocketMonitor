import test from "node:test";
import assert from "node:assert/strict";
import { RocketLogDownloader } from "../src/features/RocketLogDownloader/RocketLogDownloader.ts";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { DownloadTrafficGate } from "../src/features/RadioLink/DownloadTrafficGate.ts";

function setup(t, reader, connected = true, traffic = new DownloadTrafficGate()) {
    const store = new RocketStatusStore(() => ({}));
    store.setConnected(connected);
    t.after(() => store.suspend());
    return { store, traffic, downloader: new RocketLogDownloader(() => reader, store, traffic, async () => {}) };
}

test("downloader publishes stable snapshots, exact byte progress, and completion", async t => {
    const original = Uint8Array.from({ length: 503 }, (_, i) => i % 256);
    const { downloader, traffic } = setup(t, {
        getLogInfo: async () => ({ sizeBytes: original.length, maxChunkBytes: 240 }),
        getLogBytes: async (_, offset, length) => ({ offset, bytes: original.slice(offset, offset + length) }),
    });
    assert.equal(downloader.getProgress(), downloader.getProgress());
    assert.equal(downloader.isRunning(), false);
    const snapshots = [];
    const unsubscribe = downloader.subscribe(() => snapshots.push(downloader.getProgress()));
    const transfer = downloader.startDownload("flight");
    assert.equal(downloader.isRunning(), true);
    assert.equal(downloader.getProgress().running, true);
    assert.deepEqual(await transfer, original);
    assert.deepEqual(snapshots.map(p => p.received), [0, 0, 240, 480, 503, 503]);
    assert.deepEqual(downloader.getProgress(), {
        filename: "flight", running: false, received: 503, total: 503, state: "completed", error: null,
    });
    assert.equal(traffic.isDownloading(), false);
    unsubscribe();
    downloader.stopDownload();
    await downloader.startDownload("another");
    assert.equal(snapshots.length, 6);
});

test("stop drains the active batch, stays running until drained, and permits restarting", async t => {
    let entered;
    const ready = new Promise(resolve => { entered = resolve; });
    const pending = [];
    const { downloader, traffic } = setup(t, {
        getLogInfo: async () => ({ sizeBytes: 1100, maxChunkBytes: 240 }),
        getLogBytes: (_, offset, length) => new Promise(resolve => {
            pending.push(() => resolve({ offset, bytes: new Uint8Array(length) }));
            if (pending.length === 4) entered();
        }),
    });
    const transfer = downloader.startDownload("f");
    const outcome = transfer.catch(error => error);
    await ready;
    downloader.stopDownload(); downloader.stopDownload();
    assert.equal(downloader.isRunning(), true);
    assert.equal(downloader.getProgress().state, "stopping");
    assert.equal(traffic.isDownloading(), true);
    await assert.rejects(downloader.startDownload("other"), /already/);
    pending.forEach(finish => finish());
    assert.equal((await outcome).name, "AbortError");
    assert.equal(pending.length, 4); // No second batch after cancellation.
    assert.equal(downloader.isRunning(), false);
    assert.equal(downloader.getProgress().state, "cancelled");
    assert.equal(traffic.isDownloading(), false);
    const restarted = downloader.startDownload("other");
    downloader.stopDownload();
    await assert.rejects(restarted, { name: "AbortError" });
});

test("offline starts do not acquire traffic or change idle state", async t => {
    const { downloader, traffic } = setup(t, {}, false);
    await assert.rejects(downloader.startDownload("f"), /not connected/);
    assert.equal(downloader.getProgress().state, "idle");
    assert.equal(traffic.isDownloading(), false);
});

test("invalid metadata fails, releases exclusivity, and can be retried", async t => {
    let valid = false;
    const { downloader, traffic } = setup(t, {
        getLogInfo: async () => ({ sizeBytes: 0, maxChunkBytes: valid ? 240 : 0 }),
    });
    await assert.rejects(downloader.startDownload("f"), /Invalid/);
    assert.equal(downloader.getProgress().state, "failed");
    assert.match(downloader.getProgress().error, /Invalid/);
    assert.equal(downloader.isRunning(), false);
    assert.equal(traffic.isDownloading(), false);
    valid = true;
    assert.deepEqual(await downloader.startDownload("f"), new Uint8Array());
    assert.equal(downloader.getProgress().error, null);
});

test("traffic acquisition failure releases the polling lease without releasing another owner's traffic", async t => {
    const gate = new DownloadTrafficGate();
    const other = gate.acquireDownload();
    const { downloader } = setup(t, {}, true, gate);
    await assert.rejects(downloader.startDownload("f"), /already/);
    assert.equal(downloader.isRunning(), false);
    assert.equal(gate.isDownloading(), true);
    other.release();
});