import test from "node:test";
import assert from "node:assert/strict";
import { updateFlightClock } from "../src/features/Panels/ControlPanels/FlightPanel/flightClock.ts";
import { FlightState } from "../src/features/RocketStatus/rocketTypes.ts";

test("flight clock starts after countdown and freezes at the final transition", () => {
    let clock = updateFlightClock(FlightState.COUNTDOWN, null, null, 1000);
    assert.deepEqual(clock, { startedAt: null, elapsedMs: null });
    clock = updateFlightClock(FlightState.COUNTDOWN, clock.startedAt, clock.elapsedMs, 6000);
    assert.deepEqual(clock, { startedAt: null, elapsedMs: null });
    clock = updateFlightClock(FlightState.BURNING, clock.startedAt, clock.elapsedMs, 7000);
    assert.deepEqual(clock, { startedAt: 7000, elapsedMs: 0 });
    clock = updateFlightClock(FlightState.COASTING, clock.startedAt, clock.elapsedMs, 12500);
    assert.deepEqual(clock, { startedAt: 7000, elapsedMs: 5500 });
    clock = updateFlightClock(FlightState.DESCENDING, clock.startedAt, clock.elapsedMs, 17000);
    clock = updateFlightClock(FlightState.LANDED, clock.startedAt, clock.elapsedMs, 20150);
    assert.deepEqual(clock, { startedAt: null, elapsedMs: 13150 });
    assert.deepEqual(updateFlightClock(FlightState.LANDED, clock.startedAt, clock.elapsedMs, 30000), clock);
});

test("aborting during countdown never starts T+ and idle resets the clock", () => {
    const aborted = updateFlightClock(FlightState.ABORTED, null, null, 5000);
    assert.deepEqual(aborted, { startedAt: null, elapsedMs: null });
    assert.deepEqual(updateFlightClock(FlightState.IDLE, 1000, 3000, 5000), { startedAt: null, elapsedMs: null });
});

test("clock supports a missed burning phase and freezes when aborted after launch", () => {
    const clock = updateFlightClock(FlightState.COASTING, null, null, 10000);
    assert.deepEqual(clock, { startedAt: 10000, elapsedMs: 0 });
    assert.deepEqual(updateFlightClock(FlightState.ABORTED, clock.startedAt, 0, 12750), { startedAt: null, elapsedMs: 2750 });
});