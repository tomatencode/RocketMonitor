import test from "node:test";
import assert from "node:assert/strict";
import { returnToFlightSetup } from "../src/features/Panels/ControlPanels/FlightPanel/returnToFlightSetup.ts";

test("returning after a download already set idle dismisses the summary without END_FLIGHT", async () => {
    let reset = false;
    await returnToFlightSetup(true, async () => assert.fail("END_FLIGHT would be rejected when already idle"), () => { reset = true; });
    assert.equal(reset, true);
});

test("returning from a finished flight waits for END_FLIGHT before dismissing the summary", async () => {
    const events = [];
    let acknowledge;
    const acknowledgment = new Promise(resolve => { acknowledge = resolve; });
    const result = returnToFlightSetup(false, async () => {
        events.push("END_FLIGHT");
        await acknowledgment;
    }, () => events.push("reset"));
    assert.deepEqual(events, ["END_FLIGHT"]);
    acknowledge();
    await result;
    assert.deepEqual(events, ["END_FLIGHT", "reset"]);
});

test("a rejected END_FLIGHT keeps the summary available and surfaces the error", async () => {
    await assert.rejects(returnToFlightSetup(false, async () => {
        throw new Error("END_FLIGHT was rejected");
    }, () => assert.fail("must not dismiss after failure")), /END_FLIGHT was rejected/);
});