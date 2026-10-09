import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";
import { MessageType, JobStatus, encode, createParser, feed, take } from "../src/features/RadioLink/Protocol.ts";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";
import { listAllLogs } from "../src/features/Panels/ControlPanels/LoggingPanel/logOperations.ts";
import { DeleteLogConfirmation } from "../src/features/Panels/ControlPanels/LoggingPanel/DeleteLogConfirmation.tsx";

test("delete message IDs match firmware and survive framing", () => {
    assert.equal(MessageType.DELETE_LOG, 0x26);
    assert.equal(MessageType.DELETE_ALL_LOGS, 0x27);
    const messages = [MessageType.DELETE_LOG, MessageType.DELETE_ALL_LOGS].map((type, seqId) => ({
        type, seqId, status: JobStatus.SUCCESS, payload: new Uint8Array(),
    }));
    const parser = createParser();
    encode({ messages }).forEach(byte => feed(parser, byte));
    assert.deepEqual(take(parser), { messages });
});

test("DELETE_LOG sends only a length-prefixed filename; DELETE_ALL_LOGS is empty", async () => {
    const calls = [];
    const commands = useRadioCommands({ sendMessage: async (type, payload) => {
        calls.push({ type, payload });
        return { status: 0 };
    } });
    await commands.deleteLog("flight");
    await commands.deleteAllLogs();
    assert.equal(calls[0].type, MessageType.DELETE_LOG);
    assert.deepEqual([...calls[0].payload], [6, ...new TextEncoder().encode("flight")]);
    assert.equal(calls[1].type, MessageType.DELETE_ALL_LOGS);
    assert.equal(calls[1].payload, undefined);
    await commands.deleteLog("é".repeat(16));
    assert.equal(calls[2].payload[0], 32);
    assert.equal(calls[2].payload.length, 33);
});

test("deletion rejects invalid filenames locally and firmware FAILURE", async () => {
    let calls = 0;
    const commands = useRadioCommands({ sendMessage: async () => { calls++; return { status: 1 }; } });
    for (const name of ["", "a".repeat(33), "é".repeat(17), "a\0b"]) {
        await assert.rejects(commands.deleteLog(name), /filename/);
    }
    assert.equal(calls, 0);
    await assert.rejects(commands.deleteLog("f"), /DELETE_LOG was rejected/);
    await assert.rejects(commands.deleteAllLogs(), /DELETE_ALL_LOGS was rejected/);
});

test("commander deletes logs and paginated refresh reflects single/all removal", async t => {
    let files = ["one", "two", "three"];
    const calls = [];
    const store = new RocketStatusStore(() => ({ logging: async () => false }));
    store.setConnected(true);
    t.after(() => store.suspend());
    const commander = new RocketCommander(() => ({
        deleteLog: async filename => { calls.push(filename); files = files.filter(name => name !== filename); },
        deleteAllLogs: async () => { calls.push("all"); files = []; },
    }), store, () => ({ listLogs: async index => ({
        totalFiles: files.length, nextIndex: Math.min(index + 1, files.length), filenames: files.slice(index, index + 1),
    }) }));
    assert.deepEqual(await listAllLogs(commander, new AbortController().signal), files);
    await commander.deleteLog("two");
    assert.deepEqual(await listAllLogs(commander, new AbortController().signal), ["one", "three"]);
    await commander.deleteAllLogs();
    assert.deepEqual(await listAllLogs(commander, new AbortController().signal), []);
    assert.deepEqual(calls, ["two", "all"]);
    assert.equal(store.getSnapshot("logging").value, false);
});

test("failed deletion leaves file list untouched; offline mutations do not send", async t => {
    const files = ["one"];
    let calls = 0;
    const store = new RocketStatusStore(() => ({}));
    store.setConnected(true);
    t.after(() => store.suspend());
    const commander = new RocketCommander(() => ({
        deleteLog: async () => { calls++; throw Error("flash error"); },
        deleteAllLogs: async () => { calls++; throw Error("recording active"); },
    }), store, () => ({ listLogs: async () => ({ totalFiles: 1, nextIndex: 1, filenames: files }) }));
    await assert.rejects(commander.deleteLog("one"), /flash error/);
    await assert.rejects(commander.deleteAllLogs(), /recording active/);
    assert.deepEqual(await listAllLogs(commander, new AbortController().signal), ["one"]);
    store.setConnected(false);
    await assert.rejects(commander.deleteLog("one"), /not connected/);
    await assert.rejects(commander.deleteAllLogs(), /not connected/);
    assert.equal(calls, 2);
});

test("confirmation identifies single/all deletion, irreversibility and local-file safety", () => {
    for (const deletion of [{ filename: "flight" }, { all: true }]) {
        const html = renderToStaticMarkup(createElement(DeleteLogConfirmation, {
            deletion, disabled: false, onConfirm: () => {}, onCancel: () => {},
        }));
        assert.match(html, /role="alertdialog"/);
        assert.match(html, /cannot be undone/);
        assert.match(html, /Downloaded files on your computer are not affected/);
        assert.match(html, /Cancel/);
        assert.match(html, "all" in deletion ? /Confirm Delete All/ : /flight/);
        assert.match(html, "all" in deletion ? /reclaim flash space/ : /does not reclaim flash space/);
    }
});

test("confirmation does not delete on render; confirm and cancel are separate actions", () => {
    let confirmed = 0;
    let canceled = 0;
    const element = DeleteLogConfirmation({ deletion: { all: true }, disabled: true,
        onConfirm: () => { confirmed++; }, onCancel: () => { canceled++; } });
    const buttons = element.props.children[1].props.children;
    assert.equal(confirmed, 0);
    assert.equal(canceled, 0);
    assert.equal(buttons[0].props.disabled, true);
    buttons[1].props.onClick();
    assert.equal(canceled, 1);
    assert.equal(confirmed, 0);
    const enabled = DeleteLogConfirmation({ deletion: { filename: "f" }, disabled: false,
        onConfirm: () => { confirmed++; }, onCancel: () => {} });
    enabled.props.children[1].props.children[0].props.onClick();
    assert.equal(confirmed, 1);
});