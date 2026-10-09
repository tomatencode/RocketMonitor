import test from "node:test";
import assert from "node:assert/strict";
import { scheduleFeedbackDismissal } from "../src/features/Panels/ControlPanels/LoggingPanel/feedbackTimeout.ts";

test("feedback remains visible until ten seconds, then dismisses once", t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let dismissals = 0;
    scheduleFeedbackDismissal(() => dismissals++);
    t.mock.timers.tick(9_999);
    assert.equal(dismissals, 0);
    t.mock.timers.tick(1);
    assert.equal(dismissals, 1);
    t.mock.timers.tick(10_000);
    assert.equal(dismissals, 1);
});

test("cleanup prevents dismissal after a message clears or the panel unmounts", t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let dismissed = false;
    const cleanup = scheduleFeedbackDismissal(() => { dismissed = true; });
    t.mock.timers.tick(5_000);
    cleanup();
    t.mock.timers.tick(10_000);
    assert.equal(dismissed, false);
});

test("replacement feedback gets a full ten seconds without the old timer dismissing it", t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const dismissals = [];
    const cleanup = scheduleFeedbackDismissal(() => dismissals.push("old"));
    t.mock.timers.tick(6_000);
    cleanup();
    scheduleFeedbackDismissal(() => dismissals.push("new"));
    t.mock.timers.tick(9_999);
    assert.deepEqual(dismissals, []);
    t.mock.timers.tick(1);
    assert.deepEqual(dismissals, ["new"]);
});

test("independent feedback boxes expire according to their own appearance time", t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const dismissals = [];
    scheduleFeedbackDismissal(() => dismissals.push("saved"));
    t.mock.timers.tick(3_000);
    scheduleFeedbackDismissal(() => dismissals.push("deleted"));
    t.mock.timers.tick(7_000);
    assert.deepEqual(dismissals, ["saved"]);
    t.mock.timers.tick(3_000);
    assert.deepEqual(dismissals, ["saved", "deleted"]);
});