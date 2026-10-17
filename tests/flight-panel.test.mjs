import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlightPanel } from "../src/features/Panels/ControlPanels/FlightPanel/FlightPanel.tsx";
import { FlightSummary } from "../src/features/Panels/ControlPanels/FlightPanel/FlightSummary.tsx";
import { RocketLogDownloaderProvider } from "../src/features/RocketLogDownloader/RocketLogDownloaderContext.tsx";
import { RocketLogDownloader } from "../src/features/RocketLogDownloader/RocketLogDownloader.ts";
import { DownloadTrafficGate } from "../src/features/RadioLink/DownloadTrafficGate.ts";
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
    const downloader = new RocketLogDownloader(() => ({}), store, new DownloadTrafficGate(), commander.waitForIdle);
    return renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander },
            createElement(RocketLogDownloaderProvider, { downloader }, createElement(FlightPanel)))));
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
        assert.match(html, /Download Flight Log/);
        assert.match(html, /Flight name unavailable/);
        if (state === FlightState.ABORTED) assert.match(html, /Downloading will set the controller to idle first/);
        else assert.doesNotMatch(html, /Downloading will set the controller to idle first/);
        assert.doesNotMatch(html, /Abort Flight|Launch countdown/);
        if (state === FlightState.LANDED) assert.match(html, /Stop Locating Sound/);
        else assert.doesNotMatch(html, /Stop Locating Sound/);
    }
});

test("flight summary enables the named flight log only when connected and idle", t => {
    const store = new RocketStatusStore(() => ({}));
    t.after(() => store.suspend());
    const downloader = new RocketLogDownloader(() => ({}), store, new DownloadTrafficGate(), async () => {});
    const commander = new RocketCommander(() => ({}), store);
    const render = (flightName, ending = false) => renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander },
            createElement(RocketLogDownloaderProvider, { downloader }, createElement(FlightSummary, {
                state: FlightState.LANDED, flightName, ending, location: null, maxAltitude_m: null, maxVelocity_m_s: null, elapsedMs: null, onSetIdle: async () => {}, onPrepareIdleDownload: () => {}, onIdleDownloadReady: () => {},
            })))));
    const downloadButton = html => html.match(/<button[^>]*>[\s\S]*?Download Flight Log<\/button>/)?.[0];
    const locatingButton = html => html.match(/<button[^>]*>\s*Stop Locating Sound\s*<\/button>/)?.[0];
    assert.match(downloadButton(render("Flight-01")), /disabled=""/);
    assert.match(locatingButton(render("Flight-01")), /disabled=""/);
    store.setConnected(true);
    const ready = render("Flight-01");
    assert.match(ready, /Flight-01 · saves to Downloads/);
    assert.doesNotMatch(downloadButton(ready), /disabled=""/);
    assert.doesNotMatch(locatingButton(ready), /disabled=""/);
    assert.match(downloadButton(render(null)), /disabled=""/);
    assert.match(downloadButton(render("Flight-01", true)), /disabled=""/);
    assert.match(locatingButton(render("Flight-01", true)), /disabled=""/);
});

test("telemetry renders measurements and preserves unknown-value placeholders", () => {
    const props = { location: null, maxAltitude_m: null, maxVelocity_m_s: null, elapsedMs: null, countdownTime_ms: null };
    const unknown = renderToStaticMarkup(createElement(FlightTelemetry, props));
    assert.match(unknown, /T\+--s/);
    assert.equal((unknown.match(/>--</g) ?? []).length, 4);
    const measured = renderToStaticMarkup(createElement(FlightTelemetry, {
        ...props,
        location: { height_m: 125.35, verticalVelocity_m_s: -12.5 },
        maxAltitude_m: 150,
        maxVelocity_m_s: 42.5,
        elapsedMs: 65000,
    }));
    for (const value of ["125.3 m", "-12.5 m/s", "150.0 m", "42.5 m/s", "T+65.0s", "Peak velocity"]) assert.ok(measured.includes(value), value);
    assert.equal(formatFlightTime(-1000), "T+0.0s");
    assert.equal(formatFlightTime(1250), "T+1.3s");
});

test("mission clock changes from warning countdown to neutral elapsed time in the same card", () => {
    const props = { location: null, maxAltitude_m: null, maxVelocity_m_s: null, elapsedMs: 12300, countdownTime_ms: null };
    const countdown = renderToStaticMarkup(createElement(FlightTelemetry, { ...props, countdownTime_ms: 3200, countingDown: true }));
    assert.match(countdown, /bg-amber-950\/20/);
    assert.match(countdown, /T-3\.2s/);
    assert.doesNotMatch(countdown, /T\+12\.3s/);
    const flight = renderToStaticMarkup(createElement(FlightTelemetry, props));
    assert.match(flight, /T\+12\.3s/);
    assert.doesNotMatch(flight, /amber|Launch countdown/);
    assert.equal((countdown.match(/backdrop-blur-sm/g) ?? []).length, 5);
    assert.equal((flight.match(/backdrop-blur-sm/g) ?? []).length, 5);
    const waiting = renderToStaticMarkup(createElement(FlightTelemetry, { ...props, countingDown: true }));
    assert.match(waiting, /Launch countdown/);
    assert.doesNotMatch(waiting, /T\+12\.3s/);
});