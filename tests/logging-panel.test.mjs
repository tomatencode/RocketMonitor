import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoggingPanel } from "../src/features/Panels/ControlPanels/LoggingPanel/LoggingPanel.tsx";
import { RocketStatusProvider } from "../src/features/RocketStatus/RocketStatusContext.tsx";
import { RocketCommanderProvider } from "../src/features/RocketCommander/RocketCommanderContext.tsx";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";
import { RocketLogDownloader } from "../src/features/RocketLogDownloader/RocketLogDownloader.ts";
import { RocketLogDownloaderProvider } from "../src/features/RocketLogDownloader/RocketLogDownloaderContext.tsx";
import { DownloadTrafficGate } from "../src/features/RadioLink/DownloadTrafficGate.ts";
import { sessionTransport } from "./session-download-fixture.mjs";

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
    const downloader = new RocketLogDownloader(() => ({}), store, new DownloadTrafficGate(), commander.waitForIdle);
    return renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander },
            createElement(RocketLogDownloaderProvider, { downloader }, createElement(LoggingPanel)))));
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

test("logging panel renders service-owned download progress and cancellation", async t => {
    const store = new RocketStatusStore(() => ({}));
    store.setConnected(true);
    t.after(() => store.suspend());
    let finish;
    let entered;
    const ready = new Promise(resolve => { entered = resolve; });
    const downloader = new RocketLogDownloader(() => sessionTransport({
        getLogInfo: async () => ({ sizeBytes: 12, maxChunkBytes: 240 }),
        getLogBytes: () => { entered(); return new Promise(resolve => { finish = resolve; }); },
    }), store, new DownloadTrafficGate(), async () => {});
    const commander = new RocketCommander(() => ({}), store, undefined, downloader);
    const transfer = downloader.startDownload("flight");
    const outcome = transfer.catch(error => error);
    await ready;
    const render = () => renderToStaticMarkup(createElement(RocketStatusProvider, { store },
        createElement(RocketCommanderProvider, { commander },
            createElement(RocketLogDownloaderProvider, { downloader }, createElement(LoggingPanel)))));
    assert.match(render(), /Downloading flight:/);
    assert.match(render(), /0 \/ 12 bytes/);
    assert.match(render(), /Cancel Download/);
    downloader.stopDownload();
    assert.match(render(), /Cancelling\.\.\./);
    finish({ offset: 0, bytes: new Uint8Array(12) });
    assert.equal((await outcome).name, "AbortError");
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