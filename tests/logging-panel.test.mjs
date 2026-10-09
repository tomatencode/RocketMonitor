import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoggingPanel } from "../src/features/Panels/ControlPanels/LoggingPanel/LoggingPanel.tsx";
import { RocketStatusProvider } from "../src/features/RocketStatus/RocketStatusContext.tsx";
import { RocketCommanderProvider } from "../src/features/RocketCommander/RocketCommanderContext.tsx";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";

async function renderPanel(t, connected, recording) {
    const pollers = { logging: async () => recording, flightState: async () => 0 };
    const store = new RocketStatusStore(() => pollers);
    store.setConnected(connected);
    t.after(() => store.suspend());
    if (connected) {
        store.refresh("logging", "flightState");
        await Promise.resolve();
        await Promise.resolve();
    }
    const commander = new RocketCommander(() => ({}), store);
    return renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander }, createElement(LoggingPanel))));
}

test("logging panel renders recording indicator and stop control from shared status", async t => {
    const html = await renderPanel(t, true, true);
    assert.match(html, /Rocket Logs/);
    assert.match(html, /Recording/);
    assert.match(html, /Stop Logging/);
    assert.match(html, /Saved logs/);
    assert.match(html, /Downloads folder/);
    assert.doesNotMatch(html, /Confirm Delete/);
});

test("logging panel renders start control when stopped and offline state when disconnected", async t => {
    const stopped = await renderPanel(t, true, false);
    assert.match(stopped, /Stopped/);
    assert.match(stopped, /Start Logging/);
    const offline = await renderPanel(t, false, false);
    assert.match(offline, /Offline/);
    assert.match(offline, /disabled=""/);
    assert.match(offline, /Connect to the rocket/);
});