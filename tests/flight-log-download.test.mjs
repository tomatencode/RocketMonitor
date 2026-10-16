import test from "node:test";
import assert from "node:assert/strict";
import { downloadFlightLog, IDLE_LOG_SETTLE_DELAY_MS } from "../src/features/Panels/ControlPanels/FlightPanel/downloadFlightLog.ts";
import { FlightState } from "../src/features/RocketStatus/rocketTypes.ts";

function fixture(state = FlightState.LANDED) {
    let session = 1;
    return {
        store: { getConnected: () => true, getSession: () => session, getSnapshot: () => ({ value: state }) },
        reconnect: () => { session++; },
    };
}

test("flight log downloads the exact launch name and saves verified bytes in landed or idle", async () => {
    for (const state of [FlightState.LANDED, FlightState.IDLE]) {
        const { store } = fixture(state);
        const bytes = new Uint8Array([0, 12, 255]);
        const events = [];
        const path = await downloadFlightLog("Flight-01", {
            startDownload: async name => { events.push(["download", name]); return bytes; },
        }, store, new AbortController().signal, () => events.push(["saving"]), async (name, data) => {
            assert.equal(data, bytes);
            events.push(["save", name]);
            return "/Downloads/Flight-01.rcktlog";
        });
        assert.equal(path, "/Downloads/Flight-01.rcktlog");
        assert.deepEqual(events, [["download", "Flight-01"], ["saving"], ["save", "Flight-01"]]);
    }
});

test("missing names, offline links and active flights cannot start log downloads", async () => {
    const { store } = fixture();
    const downloader = { startDownload: async () => assert.fail("must not download") };
    const signal = new AbortController().signal;
    await assert.rejects(downloadFlightLog("", downloader, store, signal, () => {}), /Flight name is unavailable/);
    await assert.rejects(downloadFlightLog("f", downloader, { ...store, getConnected: () => false }, signal, () => {}), /not connected/);
    await assert.rejects(downloadFlightLog("f", downloader, fixture(FlightState.BURNING).store, signal, () => {}), /landed or idle/);
});

test("aborted download waits for idle acknowledgment and a settling delay before starting the transfer", async () => {
    const { store } = fixture(FlightState.ABORTED);
    const events = [];
    let acknowledge;
    const idle = new Promise(resolve => { acknowledge = resolve; });
    const result = downloadFlightLog("Flight-01", {
        startDownload: async name => { events.push(["download", name]); return new Uint8Array([1]); },
    }, store, new AbortController().signal, () => {}, async () => "/Downloads/Flight-01.rcktlog", async () => {
        events.push(["idle"]);
        await idle;
        events.push(["acknowledged"]);
    });
    assert.deepEqual(events, [["idle"]]);
    const acknowledgedAt = performance.now();
    acknowledge();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(events, [["idle"], ["acknowledged"]]);
    await result;
    assert.ok(performance.now() - acknowledgedAt >= IDLE_LOG_SETTLE_DELAY_MS - 1);
    assert.deepEqual(events, [["idle"], ["acknowledged"], ["download", "Flight-01"]]);
});

test("cancellation or reconnection during the idle settling delay prevents downloading", async () => {
    for (const outcome of ["cancelled", "reconnected"]) {
        const { store, reconnect } = fixture(FlightState.ABORTED);
        const controller = new AbortController();
        const result = downloadFlightLog("Flight-01", {
            startDownload: async () => assert.fail("must not download after cancellation or reconnection"),
        }, store, controller.signal, () => assert.fail("must not save"), undefined, async () => {});
        const rejected = assert.rejects(result);
        await new Promise(resolve => setTimeout(resolve, 20));
        if (outcome === "cancelled") controller.abort();
        else reconnect();
        await rejected;
    }
});

test("idle failures, cancellation and connection changes prevent aborted downloads", async () => {
    for (const outcome of ["missing", "failed", "cancelled", "reconnected"]) {
        const { store, reconnect } = fixture(FlightState.ABORTED);
        const controller = new AbortController();
        const setIdle = outcome === "missing" ? undefined : async () => {
            if (outcome === "failed") throw new Error("Idle refused");
            if (outcome === "cancelled") controller.abort();
            if (outcome === "reconnected") reconnect();
        };
        await assert.rejects(downloadFlightLog("Flight-01", {
            startDownload: async () => assert.fail("must not download before idle succeeds"),
        }, store, controller.signal, () => assert.fail("must not save"), undefined, setIdle));
    }
});

test("failed, cancelled and replaced-session downloads never save a file", async () => {
    for (const outcome of ["failed", "cancelled", "reconnected"]) {
        const { store, reconnect } = fixture();
        const controller = new AbortController();
        const downloader = { startDownload: async () => {
            if (outcome === "failed") throw new Error("Log not found");
            if (outcome === "cancelled") controller.abort();
            if (outcome === "reconnected") reconnect();
            return new Uint8Array([1]);
        } };
        await assert.rejects(downloadFlightLog("Flight-01", downloader, store, controller.signal,
            () => assert.fail("must not start saving"), async () => assert.fail("must not save")));
    }
});

test("save failures are surfaced instead of reporting a completed download", async () => {
    await assert.rejects(downloadFlightLog("Flight-01", { startDownload: async () => new Uint8Array() },
        fixture().store, new AbortController().signal, () => {}, async () => { throw new Error("Disk full"); }), /Disk full/);
});