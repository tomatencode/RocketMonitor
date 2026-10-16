import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlightProfileForm } from "../src/features/Panels/ControlPanels/FlightPanel/FlightProfileForm.tsx";
import { RocketStatusProvider } from "../src/features/RocketStatus/RocketStatusContext.tsx";
import { RocketCommanderProvider } from "../src/features/RocketCommander/RocketCommanderContext.tsx";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";

test("flight profile form exposes the named flight, burn duration, pyro, PD and initial attitude fields", t => {
    const store = new RocketStatusStore(() => ({}));
    t.after(() => store.suspend());
    const commander = new RocketCommander(() => ({}), store);
    const html = renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander },
            createElement(FlightProfileForm, { connected: false, launching: false, onLaunch: async () => {} }))));
    assert.match(html, /Flight Name/);
    assert.match(html, /type="text"[^>]*maxLength="32"[^>]*required=""/);
    assert.equal((html.match(/type="number"/g) ?? []).length, 8);
    assert.match(html, /Burn Phase Duration \(s\)/);
    assert.match(html, /type="number"[^>]*min="0.001"[^>]*max="4294967.295"[^>]*step="0.001"[^>]*value="6.5"/);
    for (const label of ["Igniter channel", "Parachute channel", "Kp", "Kd", "Initial X", "Initial Y", "Initial Z"]) {
        assert.ok(html.includes(label), label);
    }
    assert.doesNotMatch(html, /Countdown \(ms\)|Burn \(ms\)|Initial height|Target [XYZ]/);
    assert.match(html, /disabled=""/);
});