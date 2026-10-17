import test from "node:test";
import assert from "node:assert/strict";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";
import { MessageType } from "../src/features/RadioLink/Protocol.ts";
import { ResponseStatus } from "../src/features/RadioLink/useMessageTransport.ts";
import { RocketCommander } from "../src/features/RocketCommander/RocketCommander.ts";
import { RocketStatusStore } from "../src/features/RocketStatus/RocketStatusStore.ts";

test("SET_DO_LOCATING_SOUND matches firmware 0x25 and encodes exactly one boolean byte", async () => {
    const sent = [];
    const commands = useRadioCommands({ sendMessage: async (type, payload) => {
        sent.push([type, [...payload]]);
        return { status: ResponseStatus.SUCCESS };
    } });
    assert.equal(MessageType.SET_DO_LOCATING_SOUND, 0x25);
    await commands.setDoLocatingSound(false);
    await commands.setDoLocatingSound(true);
    assert.deepEqual(sent, [[0x25, [0]], [0x25, [1]]]);
});

test("locating sound rejects firmware refusal and propagates transport errors", async () => {
    const refused = useRadioCommands({ sendMessage: async () => ({ status: ResponseStatus.FAILURE }) });
    await assert.rejects(refused.setDoLocatingSound(false), /SET_DO_LOCATING_SOUND was rejected/);
    const offline = useRadioCommands({ sendMessage: async () => { throw Error("Timeout"); } });
    await assert.rejects(offline.setDoLocatingSound(false), /Timeout/);
});

test("commander stops locating sound without ending flight or refreshing unrelated status", async t => {
    const store = new RocketStatusStore(() => ({}));
    t.after(() => store.suspend());
    store.setConnected(true);
    const sent = [];
    let downloading = false;
    const commander = new RocketCommander(() => ({
        setDoLocatingSound: async enabled => { sent.push(enabled); },
        endFlight: async () => assert.fail("stopping the sound must not set idle"),
    }), store, undefined, { isRunning: () => downloading });
    await commander.setDoLocatingSound(false);
    assert.deepEqual(sent, [false]);
    assert.equal(store.getSnapshot("flightState").hasValue, false);
    downloading = true;
    await assert.rejects(commander.setDoLocatingSound(false), /paused/);
    downloading = false;
    store.setConnected(false);
    await assert.rejects(commander.setDoLocatingSound(false), /not connected/);
    assert.deepEqual(sent, [false]);
});

test("a reconnect before locating-sound acknowledgment reports an unknown outcome", async t => {
    const store = new RocketStatusStore(() => ({}));
    t.after(() => store.suspend());
    store.setConnected(true);
    let acknowledge;
    const commander = new RocketCommander(() => ({
        setDoLocatingSound: () => new Promise(resolve => { acknowledge = resolve; }),
    }), store);
    const stopping = commander.setDoLocatingSound(false);
    store.setConnected(false);
    store.setConnected(true);
    acknowledge();
    await assert.rejects(stopping, /outcome unknown/);
});