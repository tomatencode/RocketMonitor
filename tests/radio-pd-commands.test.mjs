import test from "node:test";
import assert from "node:assert/strict";
import { useRadioCommands } from "../src/features/RadioLink/useRadioCommands.ts";
import { MessageType } from "../src/features/RadioLink/Protocol.ts";

function setup(responseFor) {
    const calls = [];
    const commands = useRadioCommands({ sendMessage: async (type, payload) => {
        calls.push({ type, payload });
        return responseFor(type, payload);
    } });
    return { commands, calls };
}

const success = payload => ({ status: 0, payload });

const flightProfile = {
    flightName: "Flight 1",
    initialRotation: { x: -0.5, y: 0.5, z: 0, w: 1 },
    PDKp: 1.25,
    PDKd: -0.5,
    motorIgniterChannel: 2,
    parachutePyroChannel: 7,
};

test("START_COUNTDOWN encodes the name and only the visible profile parameters", async () => {
    const { commands, calls } = setup(() => success());
    await commands.startCountdown(flightProfile);

    const { type, payload } = calls[0];
    assert.equal(type, MessageType.START_COUNTDOWN);
    assert.equal(payload.length, 35);
    assert.equal(payload[0], 8);
    assert.equal(new TextDecoder().decode(payload.slice(1, 9)), "Flight 1");
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    assert.deepEqual([9, 13, 17, 21].map(offset => view.getInt32(offset, true)), [-50, 50, 0, 100]);
    assert.equal(view.getInt32(25, true), 125);
    assert.equal(view.getInt32(29, true), -50);
    assert.deepEqual([...payload.slice(33)], [2, 7]);
});

test("START_COUNTDOWN accepts the maximum name and uses UTF-8 byte offsets", async () => {
    for (const flightName of ["a".repeat(32), "é".repeat(16), "🚀".repeat(8)]) {
        const { commands, calls } = setup(() => success());
        await commands.startCountdown({ ...flightProfile, flightName });
        const payload = calls[0].payload;
        assert.equal(payload.length, 59);
        assert.equal(payload[0], 32);
        assert.equal(new TextDecoder().decode(payload.slice(1, 33)), flightName);
        assert.equal(new DataView(payload.buffer).getInt32(49, true), 125);
        assert.deepEqual([...payload.slice(57)], [2, 7]);
    }
});

test("START_COUNTDOWN rejects invalid names before transmitting", async () => {
    const { commands, calls } = setup(() => success());
    for (const flightName of ["", "   ", "a".repeat(33), "é".repeat(17), "bad\0name", undefined]) {
        await assert.rejects(commands.startCountdown({ ...flightProfile, flightName }), /Flight name/);
    }
    assert.equal(calls.length, 0);
});

test("START_COUNTDOWN rejects invalid numeric profiles before transmitting", async () => {
    const { commands, calls } = setup(() => success());
    for (const invalid of [
        { motorIgniterChannel: -1 }, { motorIgniterChannel: 256 },
        { parachutePyroChannel: 0.5 }, { parachutePyroChannel: NaN },
        { PDKp: Infinity }, { PDKd: NaN }, { PDKp: 21474836.48 },
        { PDKd: -21474836.49 },
        { initialRotation: { x: 0, y: NaN, z: 0, w: 1 } },
        { initialRotation: { x: 0, y: 0, z: 0, w: 0 } },
        { initialRotation: undefined },
    ]) {
        await assert.rejects(commands.startCountdown({ ...flightProfile, ...invalid }));
    }
    assert.equal(calls.length, 0);
});

test("PD parameter commands use the existing PD message IDs with two gains", async () => {
    const encodedParameters = new Uint8Array(8);
    const encodedView = new DataView(encodedParameters.buffer);
    encodedView.setInt32(0, 125, true);
    encodedView.setInt32(4, -50, true);
    const { commands, calls } = setup(type =>
        type === MessageType.GET_PD_PARAMETERS ? success(encodedParameters) : success());

    await commands.setPDParameters(1.25, -0.5);
    assert.equal(calls[0].type, MessageType.SET_PD_PARAMETERS);
    assert.equal(calls[0].payload.length, 8);
    assert.deepEqual([...calls[0].payload], [...encodedParameters]);

    assert.deepEqual(await commands.getPDParameters(), { kp: 1.25, kd: -0.5 });
    assert.equal(calls[1].type, MessageType.GET_PD_PARAMETERS);
});

test("GET_PD_PARAMETERS rejects a response shorter than the PD payload", async () => {
    const { commands } = setup(() => success(new Uint8Array(7)));
    await assert.rejects(commands.getPDParameters(), /invalid payload/);
});
