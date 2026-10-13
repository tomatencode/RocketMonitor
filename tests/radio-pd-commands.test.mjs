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

test("START_COUNTDOWN matches the 54-byte firmware PD profile layout", async () => {
    const { commands, calls } = setup(() => success());
    await commands.startCountdown({
        countdownDuration_ms: 5000,
        motorBurnDuration_ms: 3000,
        initialRotation: { x: 0, y: 0, z: 0, w: 1 },
        targetAngle: { x: -0.5, y: 0.5, z: 0, w: 1 },
        pidKp: 1.25,
        pidKd: -0.5,
        motorIgniterChannel: 2,
        parachutePyroChannel: 7,
        initialHeight_m: -10.25,
    });

    const { type, payload } = calls[0];
    assert.equal(type, MessageType.START_COUNTDOWN);
    assert.equal(payload.length, 54);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    assert.equal(view.getInt32(40, true), 125);
    assert.equal(view.getInt32(44, true), -50);
    assert.deepEqual([...payload.slice(48, 50)], [2, 7]);
    assert.equal(view.getInt32(50, true), -1025);
});

test("PD parameter commands use the existing PID message IDs with two gains", async () => {
    const encodedParameters = new Uint8Array(8);
    const encodedView = new DataView(encodedParameters.buffer);
    encodedView.setInt32(0, 125, true);
    encodedView.setInt32(4, -50, true);
    const { commands, calls } = setup(type =>
        type === MessageType.GET_PID_PARAMETERS ? success(encodedParameters) : success());

    await commands.setPIDParameters(1.25, -0.5);
    assert.equal(calls[0].type, MessageType.SET_PID_PARAMETERS);
    assert.equal(calls[0].payload.length, 8);
    assert.deepEqual([...calls[0].payload], [...encodedParameters]);

    assert.deepEqual(await commands.getPIDParameters(), { kp: 1.25, kd: -0.5 });
    assert.equal(calls[1].type, MessageType.GET_PID_PARAMETERS);
});

test("GET_PID_PARAMETERS rejects a response shorter than the PD payload", async () => {
    const { commands } = setup(() => success(new Uint8Array(7)));
    await assert.rejects(commands.getPIDParameters(), /invalid payload/);
});
