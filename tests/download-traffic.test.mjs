import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { DownloadTrafficGate } from "../src/features/RadioLink/DownloadTrafficGate.ts";
import { MessageType } from "../src/features/RadioLink/Protocol.ts";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
}

test("traffic gate blocks telemetry, pings, and mutations but permits download and emergency abort", async () => {
    const gate = new DownloadTrafficGate();
    const lease = gate.acquireDownload();
    await lease.ready;
    let sends = 0;
    for (const type of [MessageType.PING, MessageType.GET_IMU, MessageType.LIST_LOGS,
        MessageType.DELETE_LOG, MessageType.START_COUNTDOWN]) {
        await assert.rejects(gate.request(type, async () => { sends++; }), /paused/);
    }
    assert.equal(sends, 0);
    for (const type of [MessageType.GET_LOG_INFO, MessageType.GET_LOG_BYTES, MessageType.ABORT_FLIGHT]) {
        await gate.request(type, async () => { sends++; });
    }
    assert.equal(sends, 3);
    assert.throws(() => gate.acquireDownload(), /already/);
    lease.release(); lease.release();
    await gate.request(MessageType.PING, async () => { sends++; });
    assert.equal(sends, 4);
});

test("traffic lease waits for prior requests to settle, including failures", async () => {
    const gate = new DownloadTrafficGate();
    const old = deferred();
    const pending = gate.request(MessageType.PING, () => old.promise).catch(() => {});
    const lease = gate.acquireDownload();
    let ready = false;
    const waiting = lease.ready.then(() => { ready = true; });
    await delay(5);
    assert.equal(ready, false);
    old.reject(Error("link timeout"));
    await pending; await waiting;
    assert.equal(ready, true);
    lease.release();
});

test("status pauses polling without clearing snapshots, defers refreshes and drains old reads", async t => {
    let reads = 0;
    const old = deferred();
    const store = new RocketStatusStore(() => ({
        batteryVoltage: () => ++reads === 2 ? old.promise : Promise.resolve(reads),
        controlling: async () => false,
    }));
    store.setConnected(true);
    t.after(() => store.suspend());
    store.subscribe("batteryVoltage", () => {});
    await delay(10);
    assert.equal(reads, 2);
    const snapshot = store.getSnapshot("batteryVoltage");
    const pause = store.pausePolling();
    assert.equal(store.getSnapshot("batteryVoltage"), snapshot);
    store.refresh("controlling");
    assert.equal(store.getSnapshot("controlling").hasValue, false);
    let ready = false;
    const waiting = pause.ready.then(() => { ready = true; });
    await delay(5);
    assert.equal(ready, false);
    old.resolve(2);
    await waiting;
    await delay(10);
    assert.equal(reads, 2);
    pause.release(); pause.release();
    await delay(10);
    assert.ok(reads > 2);
    assert.equal(store.getSnapshot("controlling").value, false);
});

test("nested status leases resume only when both are released; disconnected stores stay stopped", async t => {
    let reads = 0;
    const store = new RocketStatusStore(() => ({ batteryVoltage: async () => ++reads }));
    store.setConnected(true);
    t.after(() => store.suspend());
    const first = store.pausePolling();
    const second = store.pausePolling();
    store.subscribe("batteryVoltage", () => {});
    first.release();
    await delay(5);
    assert.equal(reads, 0);
    store.setConnected(false);
    second.release();
    await delay(5);
    assert.equal(reads, 0);
    store.setConnected(true);
    await delay(5);
    assert.ok(reads > 0);
});

function services(t, reader = {}) {
    let reads = 0;
    let mutations = 0;
    const store = new RocketStatusStore(() => ({ batteryVoltage: async () => ++reads }));
    store.setConnected(true);
    t.after(() => store.suspend());
    store.subscribe("batteryVoltage", () => {});
    const gate = new DownloadTrafficGate();
    const commander = new RocketCommander(() => ({
        beepBuzzer: async () => { mutations++; }, abortFlight: async () => { mutations++; },
    }), store, () => reader, gate);
    return { store, gate, commander, reads: () => reads, mutations: () => mutations };
}

test("exclusive download pauses status, rejects unrelated commander requests, and resumes afterward", async t => {
    const s = services(t, { getLogInfo: async () => ({ sizeBytes: 0, maxChunkBytes: 240 }) });
    const entered = deferred();
    const finish = deferred();
    let scoped;
    const downloading = s.commander.withLogDownload(async reader => {
        scoped = reader;
        assert.deepEqual(await reader.getLogInfo("f"), { sizeBytes: 0, maxChunkBytes: 240 });
        entered.resolve();
        return finish.promise;
    });
    await entered.promise;
    const count = s.reads();
    await delay(10);
    assert.equal(s.reads(), count);
    await assert.rejects(s.commander.beepBuzzer(), /paused/);
    await assert.rejects(s.commander.listLogs(), /paused/);
    await assert.rejects(s.commander.getLogBytes("f", 0, 1), /paused/);
    await assert.rejects(s.commander.withLogDownload(async () => {}), /paused/);
    assert.equal(s.mutations(), 0);
    finish.resolve("done");
    assert.equal(await downloading, "done");
    assert.equal(s.gate.isDownloading(), false);
    await assert.rejects(scoped.getLogInfo("f"), /expired/);
    await s.commander.beepBuzzer();
    await delay(10);
    assert.ok(s.reads() > count);
});

test("downloads drain existing commander operations before issuing chunks", async t => {
    const old = deferred();
    const store = new RocketStatusStore(() => ({}));
    store.setConnected(true);
    t.after(() => store.suspend());
    const commander = new RocketCommander(() => ({ beepBuzzer: () => old.promise }), store, () => ({}));
    const previous = commander.beepBuzzer();
    let entered = false;
    const transfer = commander.withLogDownload(async () => { entered = true; });
    await delay(5);
    assert.equal(entered, false);
    old.resolve();
    await previous; await transfer;
    assert.equal(entered, true);
});

test("failure and cancellation release traffic and status leases after outstanding chunks drain", async t => {
    const chunk = deferred();
    const s = services(t, { getLogBytes: () => chunk.promise });
    const controller = new AbortController();
    const entered = deferred();
    const transfer = s.commander.withLogDownload(async reader => {
        // Deliberately fail before waiting for the started chunk, exercising finally cleanup.
        void reader.getLogBytes("f", 0, 1).catch(() => {});
        entered.resolve();
        throw Error("transfer failed");
    }, controller.signal);
    const result = transfer.catch(error => error);
    await entered.promise;
    controller.abort();
    await delay(5);
    assert.equal(s.gate.isDownloading(), true);
    chunk.resolve({ offset: 0, bytes: new Uint8Array([1]) });
    assert.match((await result).message, /transfer failed/);
    assert.equal(s.gate.isDownloading(), false);
    await s.commander.beepBuzzer();
    const canceled = new AbortController();
    canceled.abort();
    await assert.rejects(s.commander.withLogDownload(async () => {}, canceled.signal), { name: "AbortError" });
    assert.equal(s.gate.isDownloading(), false);
});

test("emergency abort cancels transfer and is never blocked by the download lease", async t => {
    const chunk = deferred();
    const s = services(t, { getLogBytes: () => chunk.promise });
    const entered = deferred();
    const transfer = s.commander.withLogDownload(async reader => {
        const result = reader.getLogBytes("f", 0, 1);
        entered.resolve();
        return result;
    });
    const outcome = transfer.catch(error => error);
    await entered.promise;
    await s.commander.abortFlight();
    assert.equal(s.mutations(), 1);
    chunk.resolve({ offset: 0, bytes: new Uint8Array([1]) });
    assert.equal((await outcome).name, "AbortError");
    assert.equal(s.gate.isDownloading(), false);
});

test("a disconnect during exclusive download rejects results and does not resume offline polling", async t => {
    const chunk = deferred();
    const s = services(t, { getLogBytes: () => chunk.promise });
    const entered = deferred();
    const transfer = s.commander.withLogDownload(async reader => {
        const result = reader.getLogBytes("f", 0, 1);
        entered.resolve();
        return result;
    });
    const outcome = transfer.catch(error => error);
    await entered.promise;
    s.store.setConnected(false);
    chunk.resolve({ offset: 0, bytes: new Uint8Array([1]) });
    assert.match((await outcome).message, /connection changed/);
    const count = s.reads();
    await delay(5);
    assert.equal(s.reads(), count);
    assert.equal(s.gate.isDownloading(), false);
});