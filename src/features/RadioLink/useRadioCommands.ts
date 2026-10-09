import { MessageType } from "./Protocol";
import { ResponseStatus } from "./useMessageTransport";
import {
    decode as decodeQuaternion,
    encode as encodeQuaternion,
    ENCODED_SIZE as QUATERNION_ENCODED_SIZE,
} from "./codecs/quaternion";
import type { Quaternion } from "./codecs/quaternion";
import { decode16, decode32, encode16, encode32 } from "./codecs/fixedPoint";
import { decodeU32, encodeU16, encodeU32 } from "./codecs/littleEndian";

import type { IMUData, BaroData, RotationData, GimbalData, FlightLocationData, PIDParameters, FlightProfile } from "../RocketStatus/rocketTypes";
import { FlightState } from "../RocketStatus/rocketTypes";
export * from "../RocketStatus/rocketTypes";

type SendMessage = (
    messageType: MessageType,
    payload?: Uint8Array,
) => Promise<{ status: ResponseStatus; payload?: Uint8Array }>;

interface UseRadioCommandsOptions {
    sendMessage: SendMessage;
}

/**
 * Some requests use FAILURE as a normal "refused" outcome (e.g. ABORT_FLIGHT in
 * a state that doesn't allow it), so their status must not be dropped on the floor.
 */
function ensureSuccess(status: ResponseStatus, command: string): void {
    if (status === ResponseStatus.FAILURE) {
        throw new Error(`${command} was rejected`);
    }
}

/**
 * Thin, typed wrappers around the radio transport's `sendMessage`.
 *
 * Each command encodes its payload, awaits the response and decodes it back
 * into a plain value. The transport owns framing/transmission, so there is no
 * separate queue step: calling a command always sends it.
 */
export function useRadioCommands({ sendMessage }: UseRadioCommandsOptions) {
    const setGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const payload = new Uint8Array(4);
        encode16(degX, payload, 0);
        encode16(degY, payload, 2);
        const response = await sendMessage(MessageType.SET_GIMBAL, payload);
        ensureSuccess(response.status, "SET_GIMBAL");
    };

    const getGimbal = async (): Promise<GimbalData> => {
        const response = await sendMessage(MessageType.GET_GIMBAL);

        if (!response.payload || response.payload.byteLength < 4) {
            throw new Error("GET_GIMBAL response has an invalid payload");
        }

        return {
            degX_deg: decode16(response.payload, 0),
            degY_deg: decode16(response.payload, 2),
        };
    };

    const beepBuzzer = async (): Promise<void> => {
        const response = await sendMessage(MessageType.DO_BEEP);
        ensureSuccess(response.status, "DO_BEEP");
    };

    const firePyroChanel = async (channel: number, durationMs?: number): Promise<void> => {
        let payload: Uint8Array;
        if (durationMs === undefined) {
            payload = new Uint8Array([channel]);
        } else {
            payload = new Uint8Array(3);
            payload[0] = channel;
            encodeU16(durationMs, payload, 1);
        }
        const response = await sendMessage(MessageType.FIRE_PYRO, payload);
        ensureSuccess(response.status, "FIRE_PYRO");
    };

    const getPyroContinuity = async (channel: number): Promise<boolean> => {
        const response = await sendMessage(MessageType.GET_PYRO_CONTINUITY, new Uint8Array([channel]));

        if (!response.payload || response.payload.byteLength < 1) {
            throw new Error("GET_PYRO_CONTINUITY response has an invalid payload");
        }

        return response.payload[0] !== 0;
    };

    const getPyroSoftwareArmed = async (): Promise<boolean> => {
        const response = await sendMessage(MessageType.GET_PYRO_SOFTWARE_ARMED);

        if (!response.payload || response.payload.byteLength < 1) {
            throw new Error("GET_PYRO_SOFTWARE_ARMED response has an invalid payload");
        }

        return response.payload[0] !== 0;
    };

    const setPyroSoftwareArmed = async (armed: boolean): Promise<void> => {
        const response = await sendMessage(MessageType.SET_PYRO_SOFTWARE_ARMED, new Uint8Array([armed ? 1 : 0]));
        ensureSuccess(response.status, "SET_PYRO_SOFTWARE_ARMED");
    };

    const getPyroHardwareArmed = async (): Promise<boolean> => {
        const response = await sendMessage(MessageType.GET_PYRO_HARDWARE_ARMED);

        if (!response.payload || response.payload.byteLength < 1) {
            throw new Error("GET_PYRO_HARDWARE_ARMED response has an invalid payload");
        }

        return response.payload[0] !== 0;
    };

    const getIMU = async (): Promise<IMUData> => {
        const response = await sendMessage(MessageType.GET_IMU);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_IMU response has an invalid payload");
        }

        const payload = response.payload;
        return {
            accelX_m_s2: decode16(payload, 0),
            accelY_m_s2: decode16(payload, 2),
            accelZ_m_s2: decode16(payload, 4),
            gyroX_rad_s: decode16(payload, 6),
            gyroY_rad_s: decode16(payload, 8),
            gyroZ_rad_s: decode16(payload, 10),
        };
    };

    const getBaro = async (): Promise<BaroData> => {
        const response = await sendMessage(MessageType.GET_BAROMETER);

        if (!response.payload || response.payload.byteLength < 8) {
            throw new Error("GET_BARO response has an invalid payload");
        }

        return {
            pressure_Pa: decode32(response.payload, 0),
            temperature_C: decode32(response.payload, 4),
        };
    };

    /**
    * Current attitude as a quaternion (x, y, z, w). Use
    * `quaternionToEulerXYZ` from `codecs/quaternion` for XYZ angles;
    * firmware labels X as yaw, Y as pitch, and Z as roll.
     */
    const getRotation = async (): Promise<RotationData> => {
        const response = await sendMessage(MessageType.GET_ROTATION);

        if (!response.payload || response.payload.byteLength < QUATERNION_ENCODED_SIZE) {
            throw new Error("GET_ROTATION response has an invalid payload");
        }

        return decodeQuaternion(response.payload, 0);
    };

    /**
    * Overwrites the accumulated attitude. Build the quaternion with
    * `eulerXYZToQuaternion(x, y, z)`; firmware labels X as yaw, Y as pitch,
    * and Z as roll.
     */
    const setRotation = async (quaternion: Quaternion): Promise<void> => {
        const payload = new Uint8Array(QUATERNION_ENCODED_SIZE);
        encodeQuaternion(quaternion, payload, 0);
        const response = await sendMessage(MessageType.SET_ROTATION, payload);
        ensureSuccess(response.status, "SET_ROTATION");
    };

    // Enables/disables integrating the IMU gyro into the accumulated attitude.
    // Throws if the firmware rejects the request.
    const setAccumulatingRotation = async (accumulating: boolean): Promise<void> => {
        const response = await sendMessage(MessageType.SET_ACCUMULATING_ROTATION, new Uint8Array([accumulating ? 1 : 0]));
        ensureSuccess(response.status, "SET_ACCUMULATING_ROTATION");
    };

    // Throws if the current flight state refuses the abort.
    const abortFlight = async (): Promise<void> => {
        const response = await sendMessage(MessageType.ABORT_FLIGHT);
        ensureSuccess(response.status, "ABORT_FLIGHT");
    };

    // Throws if the firmware refuses to return to IDLE (already IDLE or mid flight).
    const endFlight = async (): Promise<void> => {
        const response = await sendMessage(MessageType.END_FLIGHT);
        ensureSuccess(response.status, "END_FLIGHT");
    };

    const getBaroHeight = async (): Promise<number> => {
        const response = await sendMessage(MessageType.GET_BARO_HEIGHT);

        // FAILURE means the calculator has no valid height yet (never calibrated / no measurement).
        if (response.status === ResponseStatus.FAILURE) {
            throw new Error("Baro height is not available yet — calibrate the sensor first");
        }

        if (!response.payload || response.payload.byteLength < 4) {
            throw new Error("GET_BARO_HEIGHT response has an invalid payload");
        }

        return decode32(response.payload, 0);
    };

    // Re-bases the barometric height so the current measurement reads `height_m`
    // (0 on the launch pad). Throws if the firmware has no valid measurement yet.
    const calibrateBaroHeight = async (height_m: number): Promise<void> => {
        const payload = new Uint8Array(4);
        encode32(height_m, payload, 0);
        const response = await sendMessage(MessageType.CALIBRATE_BARO_HEIGHT, payload);
        ensureSuccess(response.status, "CALIBRATE_BARO_HEIGHT");
    };

    const getFlightLocation = async (): Promise<FlightLocationData> => {
        const response = await sendMessage(MessageType.GET_FLIGHT_LOCATION);

        if (!response.payload || response.payload.byteLength < 24) {
            throw new Error("GET_FLIGHT_LOCATION response has an invalid payload");
        }

        const payload = response.payload;
        return {
            posX_m: decode32(payload, 0),
            posY_m: decode32(payload, 4),
            velX_m_s: decode32(payload, 8),
            velY_m_s: decode32(payload, 12),
            height_m: decode32(payload, 16),
            verticalVelocity_m_s: decode32(payload, 20),
        };
    };

    const getFlightState = async (): Promise<FlightState> => {
        const response = await sendMessage(MessageType.GET_FLIGHT_STATE);

        if (!response.payload || response.payload.byteLength < 1) {
            throw new Error("GET_FLIGHT_STATE response has an invalid payload");
        }

        return response.payload[0] as FlightState;
    };

    /** Remaining countdown time in ms; null when no countdown is active. */
    const getCountdownTime = async (): Promise<number | null> => {
        const response = await sendMessage(MessageType.GET_COUNTDOWN_TIME);

        // FAILURE is the normal "not counting down" outcome, not an error.
        if (response.status === ResponseStatus.FAILURE) {
            return null;
        }

        if (!response.payload || response.payload.byteLength < 4) {
            throw new Error("GET_COUNTDOWN_TIME response has an invalid payload");
        }

        return decodeU32(response.payload, 0);
    };

    // Omitting durationMs flashes with the LED's default duration.
    // Throws if a duration was given but is 0.
    const flashLed = async (durationMs?: number): Promise<void> => {
        let payload: Uint8Array | undefined;
        if (durationMs !== undefined) {
            payload = new Uint8Array(2);
            encodeU16(durationMs, payload, 0);
        }
        const response = await sendMessage(MessageType.FLASH_LED, payload);
        ensureSuccess(response.status, "FLASH_LED");
    };

    // Starts the launch countdown; throws if the firmware refuses (not IDLE or preflight failed).
    // See FlightProfile for the countdown/burn durations, attitude, PID gains, pyro channels and start height.
    const startCountdown = async (profile: FlightProfile): Promise<void> => {
        const payload = new Uint8Array(58);
        encodeU32(profile.countdownDuration_ms, payload, 0);
        encodeU32(profile.motorBurnDuration_ms, payload, 4);
        encodeQuaternion(profile.initialRotation, payload, 8);
        encodeQuaternion(profile.targetAngle, payload, 24);
        encode32(profile.pidKp, payload, 40);
        encode32(profile.pidKi, payload, 44);
        encode32(profile.pidKd, payload, 48);
        payload[52] = profile.motorIgniterChannel;
        payload[53] = profile.parachutePyroChannel;
        encode32(profile.initialHeight_m, payload, 54);
        const response = await sendMessage(MessageType.START_COUNTDOWN, payload);
        ensureSuccess(response.status, "START_COUNTDOWN");
    };

    // Only accepted while ABORTED; throws otherwise (or if deployment was refused).
    const retryDeployParachute = async (): Promise<void> => {
        const response = await sendMessage(MessageType.RETRY_DEPLOY_PARACHUTE);
        ensureSuccess(response.status, "RETRY_DEPLOY_PARACHUTE");
    };

    const setPIDParameters = async (kp: number, ki: number, kd: number): Promise<void> => {
        const payload = new Uint8Array(12);
        encode32(kp, payload, 0);
        encode32(ki, payload, 4);
        encode32(kd, payload, 8);
        const response = await sendMessage(MessageType.SET_PID_PARAMETERS, payload);
        ensureSuccess(response.status, "SET_PID_PARAMETERS");
    };

    /** Returns null until all three gains have been configured on the firmware. */
    const getPIDParameters = async (): Promise<PIDParameters | null> => {
        const response = await sendMessage(MessageType.GET_PID_PARAMETERS);

        // FAILURE is the normal "not configured yet" outcome, not an error.
        if (response.status === ResponseStatus.FAILURE) {
            return null;
        }

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_PID_PARAMETERS response has an invalid payload");
        }

        const payload = response.payload;
        return {
            kp: decode32(payload, 0),
            ki: decode32(payload, 4),
            kd: decode32(payload, 8),
        };
    };

    // Throws if starting was refused (PID parameters or target not configured).
    const setControlling = async (controlling: boolean): Promise<void> => {
        const response = await sendMessage(MessageType.SET_CONTROLLING, new Uint8Array([controlling ? 1 : 0]));
        ensureSuccess(response.status, "SET_CONTROLLING");
    };

    const getControlling = async (): Promise<boolean> => {
        const response = await sendMessage(MessageType.GET_CONTROLLING);

        if (!response.payload || response.payload.byteLength < 1) {
            throw new Error("GET_CONTROLLING response has an invalid payload");
        }

        return response.payload[0] !== 0;
    };

    const setPIDTarget = async (target: Quaternion): Promise<void> => {
        const payload = new Uint8Array(QUATERNION_ENCODED_SIZE);
        encodeQuaternion(target, payload, 0);
        const response = await sendMessage(MessageType.SET_PID_TARGET, payload);
        ensureSuccess(response.status, "SET_PID_TARGET");
    };

    /** Returns null until a target attitude has been configured on the firmware. */
    const getPIDTarget = async (): Promise<Quaternion | null> => {
        const response = await sendMessage(MessageType.GET_PID_TARGET);

        // FAILURE is the normal "not configured yet" outcome, not an error.
        if (response.status === ResponseStatus.FAILURE) {
            return null;
        }

        if (!response.payload || response.payload.byteLength < QUATERNION_ENCODED_SIZE) {
            throw new Error("GET_PID_TARGET response has an invalid payload");
        }

        return decodeQuaternion(response.payload, 0);
    };

    const getBatteryVoltage = async (): Promise<number> => {
        const response = await sendMessage(MessageType.GET_BATTERY_VOLTAGE);

        if (!response.payload || response.payload.byteLength < 2) {
            throw new Error("GET_BATTERY_VOLTAGE response has an invalid payload");
        }

        return decode16(response.payload, 0);
    };

    return {
        setGimbalPos,
        getGimbal,
        beepBuzzer,
        firePyroChanel,
        getPyroContinuity,
        getPyroSoftwareArmed,
        setPyroSoftwareArmed,
        getPyroHardwareArmed,
        getIMU,
        getBaro,
        getRotation,
        setRotation,
        setAccumulatingRotation,
        abortFlight,
        endFlight,
        getBaroHeight,
        calibrateBaroHeight,
        getFlightLocation,
        getFlightState,
        getCountdownTime,
        flashLed,
        startCountdown,
        retryDeployParachute,
        setPIDParameters,
        getPIDParameters,
        setControlling,
        getControlling,
        setPIDTarget,
        getPIDTarget,
        getBatteryVoltage,
    };
}

