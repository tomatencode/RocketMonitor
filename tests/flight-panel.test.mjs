import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlightPanel } from "../src/features/Panels/ControlPanels/FlightPanel/FlightPanel.tsx";
import { FlightTelemetry, formatFlightTime } from "../src/features/Panels/ControlPanels/FlightPanel/FlightTelemetry.tsx";
import { RocketStatusProvider } from "../src/features/RocketStatus/RocketStatusContext.tsx";
import { RocketCommanderProvider } from "../src/features/RocketCommander/RocketCommanderContext.tsx";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";
import { FlightState } from "../src/features/RocketStatus/rocketTypes.ts";

async function renderPanel(t, state, armed = false) {
    const pollers = {
        flightState: async () => state,
        pyroSoftwareArmed: async () => armed,
        countdownTime: async () => 3200,
    };
    const store = new RocketStatusStore(() => pollers);
    t.after(() => store.suspend());
    if (state !== null) {
        store.setConnected(true);
        store.refresh("flightState", "pyroSoftwareArmed", "countdownTime");
        await Promise.resolve();
        await Promise.resolve();
    }
    const commander = new RocketCommander(() => ({}), store);
    return renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander }, createElement(FlightPanel))));
}

test("flight panel explains its offline state without showing launch controls", async t => {
    const html = await renderPanel(t, null);
    assert.match(html, /Rocket offline/);
    assert.match(html, /Connect to the rocket to configure and monitor a flight/);
    assert.doesNotMatch(html, /Arm Pyro|Abort Flight/);
});

test("flight setup groups profile, guidance and launch controls with explicit interlock status", async t => {
    const safe = await renderPanel(t, FlightState.IDLE);
    for (const label of ["Flight profile", "Pyro channels", "Guidance &amp; attitude", "Launch control", "Pyro safe", "Arm Pyro"]) {
        assert.ok(safe.includes(label), label);
    }
    assert.doesNotMatch(safe, /Confirm Launch|Disarm Pyro/);
    const armed = await renderPanel(t, FlightState.IDLE, true);
    assert.match(armed, /Pyro armed/);
    assert.match(armed, /Verify the launch area is clear/);
    assert.match(armed, /Disarm Pyro/);
});

test("countdown is prominent only during the countdown phase", async t => {
    const countdown = await renderPanel(t, FlightState.COUNTDOWN);
    assert.match(countdown, /Launch countdown/);
    assert.match(countdown, /T-3\.2/);
    assert.match(countdown, /Abort Flight/);
    assert.match(countdown, /Retry Deploy/);
    const burning = await renderPanel(t, FlightState.BURNING);
    assert.match(burning, /Flight telemetry/);
    assert.doesNotMatch(burning, /Launch countdown/);
});

test("completed and aborted flights show a summary and reset control", async t => {
    for (const [state, label] of [[FlightState.LANDED, "Flight complete"], [FlightState.ABORTED, "Flight aborted"]]) {
        const html = await renderPanel(t, state);
        assert.ok(html.includes(label));
        assert.match(html, /Set Idle/);
        assert.doesNotMatch(html, /Abort Flight|Launch countdown/);
    }
});

test("telemetry renders measurements and preserves unknown-value placeholders", () => {
    const props = { location: null, maxAltitude_m: null, elapsedMs: null, countdownTime_ms: null };
    const unknown = renderToStaticMarkup(createElement(FlightTelemetry, props));
    assert.match(unknown, /--:--/);
    assert.equal((unknown.match(/>--</g) ?? []).length, 3);
    const measured = renderToStaticMarkup(createElement(FlightTelemetry, {
        ...props,
        location: { height_m: 125.35, verticalVelocity_m_s: -12.5 },
        maxAltitude_m: 150,
        elapsedMs: 65000,
    }));
    for (const value of ["125.3 m", "-12.5 m/s", "150.0 m", "01:05"]) assert.ok(measured.includes(value), value);
    assert.equal(formatFlightTime(-1000), "00:00");
});