import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";

const tick = () => delay(10);
function deferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}
function setup(t, pollers) {
    const store = new RocketStatusStore(() => pollers);
    store.setConnected(true);
    t.after(() => store.suspend());
    return store;
}

test("cached settings share one successful read, including null, across remounts", async t => {
    let reads = 0;
    const store = setup(t, { pidParameters: async () => { reads++; return null; } });
    const listener = () => {};
    const a = store.subscribe("pidParameters", listener);
    const b = store.subscribe("pidParameters", listener);
    await tick();
    assert.equal(reads, 1);
    assert.equal(store.getSnapshot("pidParameters").hasValue, true);
    assert.equal(store.getSnapshot("pidParameters").value, null);
    a(); b();
    const c = store.subscribe("pidParameters", listener);
    await tick();
    assert.equal(reads, 1);
    c();
});

test("all four command-only settings stop after one successful read", async t => {
    const counts = {};
    const topics = ["pidParameters", "pidTarget", "controlling", "pyroSoftwareArmed"];
    const pollers = Object.fromEntries(topics.map(topic => [topic, async () => {
        counts[topic] = (counts[topic] ?? 0) + 1;
        return topic.startsWith("pid") ? null : false;
    }]));
    const store = setup(t, pollers);
    topics.forEach(topic => store.subscribe(topic, () => {}));
    await tick();
    topics.forEach(topic => assert.equal(counts[topic], 1));
});

test("telemetry is demand-driven, shared, and stops at the last unsubscribe", async t => {
    let reads = 0;
    const store = setup(t, { batteryVoltage: async () => ++reads });
    await tick();
    assert.equal(reads, 0);
    const a = store.subscribe("batteryVoltage", () => {});
    const b = store.subscribe("batteryVoltage", () => {});
    await tick();
    assert.ok(reads > 1);
    a();
    const before = reads;
    await tick();
    assert.ok(reads > before);
    b();
    const stopped = reads;
    await tick();
    assert.equal(reads, stopped);
});

test("disconnect clears status; reconnect rereads cached settings", async t => {
    let reads = 0;
    const store = setup(t, { controlling: async () => { reads++; return true; } });
    store.subscribe("controlling", () => {});
    await tick();
    store.setConnected(false);
    assert.equal(store.getSnapshot("controlling").hasValue, false);
    await tick();
    assert.equal(reads, 1);
    store.setConnected(true);
    await tick();
    assert.equal(reads, 2);
});

test("reconnect ignores an old in-flight response and starts a fresh read", async t => {
    const old = deferred();
    let reads = 0;
    const store = setup(t, { controlling: () => ++reads === 1 ? old.promise : Promise.resolve(true) });
    store.subscribe("controlling", () => {});
    store.setConnected(false);
    store.setConnected(true);
    old.resolve(false);
    await tick();
    assert.equal(reads, 2);
    assert.equal(store.getSnapshot("controlling").value, true);
});

test("a setter invalidates an older read and publishes firmware readback, not input", async t => {
    const old = deferred();
    let reads = 0;
    const store = setup(t, { pidParameters: () => ++reads === 1 ? old.promise :
        Promise.resolve({ kp: 1.23, ki: 0, kd: 0 }) });
    store.subscribe("pidParameters", () => {});
    const commander = new RocketCommander(() => ({ setPIDParameters: async () => {} }), store);
    await commander.setPIDParameters(1.23456, 0, 0);
    assert.equal(store.getSnapshot("pidParameters").hasValue, false);
    old.resolve({ kp: 99, ki: 99, kd: 99 });
    await tick();
    assert.equal(reads, 2);
    assert.deepEqual(store.getSnapshot("pidParameters").value, { kp: 1.23, ki: 0, kd: 0 });
});

test("commander refreshes configuration even without subscribers", async t => {
    let armed = false;
    let reads = 0;
    const store = setup(t, { pyroSoftwareArmed: async () => { reads++; return armed; } });
    const commander = new RocketCommander(() => ({ setPyroSoftwareArmed: async value => { armed = value; } }), store);
    await commander.setPyroSoftwareArmed(true);
    await tick();
    assert.equal(store.getSnapshot("pyroSoftwareArmed").value, true);
    store.subscribe("pyroSoftwareArmed", () => {});
    await tick();
    assert.equal(reads, 1);
});

test("rejected mutation preserves confirmed status and does not request readback", async t => {
    let reads = 0;
    const store = setup(t, { controlling: async () => { reads++; return false; } });
    store.subscribe("controlling", () => {});
    await tick();
    const snapshot = store.getSnapshot("controlling");
    const commander = new RocketCommander(() => ({ setControlling: async () => { throw Error("rejected"); } }), store);
    await assert.rejects(commander.setControlling(true), /rejected/);
    assert.equal(store.getSnapshot("controlling"), snapshot);
    assert.equal(reads, 1);
});

test("readback failure is a status error, not a failed mutation; retry recovers", async t => {
    let reads = 0;
    const store = setup(t, { controlling: async () => {
        if (++reads === 1) throw Error("readback unavailable");
        return true;
    }, gimbal: async () => ({ degX_deg: 0, degY_deg: 0 }) });
    const commander = new RocketCommander(() => ({ setControlling: async () => {} }), store);
    await commander.setControlling(true);
    await tick();
    assert.match(store.getSnapshot("controlling").error, /readback unavailable/);
    assert.equal(reads, 1);
    await delay(270);
    assert.equal(reads, 2);
    assert.equal(store.getSnapshot("controlling").error, null);
    assert.equal(store.getSnapshot("controlling").value, true);
});

test("continuity is keyed by channel, shares reads, and respects hardware cadence", async t => {
    const reads = [];
    const store = setup(t, { pyroContinuity: async channel => { reads.push(channel); return channel === 2; } });
    store.subscribe("pyroContinuity:2", () => {});
    store.subscribe("pyroContinuity:2", () => {});
    store.subscribe("pyroContinuity:7", () => {});
    await tick();
    assert.deepEqual(reads, [2, 7]);
    assert.equal(store.getSnapshot("pyroContinuity:2").value, true);
    assert.equal(store.getSnapshot("pyroContinuity:7").value, false);
});

test("commander blocks offline commands and reports session changes as unknown outcome", async t => {
    const store = setup(t, {});
    const pending = deferred();
    let calls = 0;
    const commander = new RocketCommander(() => ({ beepBuzzer: () => { calls++; return pending.promise; } }), store);
    store.setConnected(false);
    await assert.rejects(commander.beepBuzzer(), /not connected/);
    assert.equal(calls, 0);
    store.setConnected(true);
    const result = commander.beepBuzzer();
    store.setConnected(false);
    pending.resolve();
    await assert.rejects(result, /outcome unknown/);
});

test("abort is not blocked behind an unrelated slow command", async t => {
    const store = setup(t, {});
    const pending = deferred();
    let aborted = false;
    const commander = new RocketCommander(() => ({
        beepBuzzer: () => pending.promise,
        abortFlight: async () => { aborted = true; },
    }), store);
    const beep = commander.beepBuzzer();
    await commander.abortFlight();
    assert.equal(aborted, true);
    store.suspend();
    pending.resolve();
    await assert.rejects(beep, /outcome unknown/);
});

test("all low-level mutations reject firmware FAILURE", async () => {
    const commands = useRadioCommands({ sendMessage: async () => ({ status: 1 }) });
    const q = { x: 0, y: 0, z: 0, w: 1 };
    const args = {
        setGimbalPos: [0, 0], beepBuzzer: [], firePyroChanel: [0, 200],
        setPyroSoftwareArmed: [true], setRotation: [q], setAccumulatingRotation: [true],
        abortFlight: [], endFlight: [], calibrateBaroHeight: [0], flashLed: [],
        startCountdown: [{ countdownDuration_ms: 5000, motorBurnDuration_ms: 3000,
            initialRotation: q, targetAngle: q, pidKp: 0, pidKi: 0, pidKd: 0,
            motorIgniterChannel: 0, parachutePyroChannel: 1, initialHeight_m: 0 }],
        retryDeployParachute: [], setPIDParameters: [0, 0, 0], setControlling: [true], setPIDTarget: [q],
    };
    for (const [name, parameters] of Object.entries(args)) {
        await assert.rejects(commands[name](...parameters), /rejected/, name);
    }
});

test("commander wraps every mutation and forwards its arguments", async t => {
    const reads = new Proxy({}, { get: () => async () => null });
    const store = setup(t, reads);
    const forwarded = [];
    const commands = new Proxy({}, { get: (_, name) => async (...args) => { forwarded.push([name, args]); } });
    const commander = new RocketCommander(() => commands, store);
    const q = { x: 0, y: 0, z: 0, w: 1 };
    const cases = {
        setGimbalPos: [1, 2], beepBuzzer: [], firePyroChanel: [7, 100],
        setPyroSoftwareArmed: [true], setRotation: [q], setAccumulatingRotation: [false],
        abortFlight: [], endFlight: [], calibrateBaroHeight: [12], flashLed: [100],
        startCountdown: [{ initialRotation: q }], retryDeployParachute: [],
        setPIDParameters: [1, 2, 3], setControlling: [false], setPIDTarget: [q],
    };
    for (const [name, args] of Object.entries(cases)) await commander[name](...args);
    assert.deepEqual(forwarded, Object.entries(cases));
});

test("suspend/resume preserves subscriptions for StrictMode effect replay", async t => {
    let reads = 0;
    let notifications = 0;
    const store = setup(t, { controlling: async () => { reads++; return false; } });
    store.subscribe("controlling", () => { notifications++; });
    await tick();
    store.suspend();
    store.setConnected(true);
    await tick();
    assert.equal(reads, 2);
    assert.ok(notifications >= 3);
});