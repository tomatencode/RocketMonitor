import { MessageType } from "./Protocol";
import { ResponseStatus } from "./useMessageTransport";

export interface IMUData {
    accelX_m_s2: number;
    accelY_m_s2: number;
    accelZ_m_s2: number;
    gyroX_rad_s: number;
    gyroY_rad_s: number;
    gyroZ_rad_s: number;
}

export interface BaroData {
    pressure_Pa: number;
    temperature_C: number;
}

export interface RotationData {
    roll_rad: number;
    pitch_rad: number;
    yaw_rad: number;
}

export interface GimbalData {
    degX_deg: number;
    degY_deg: number;
}

export interface FlightLocationData {
    posX_m: number;
    posY_m: number;
    velX_m_s: number;
    velY_m_s: number;
    height_m: number;
    verticalVelocity_m_s: number;
}

/** Mirrors the firmware's FlightState enum (stateManagement/FlightStateManager.hpp). */
export enum FlightState {
    IDLE = 0,
    COUNTDOWN = 1,
    BURNING = 2,
    COASTING = 3,
    DESCENDING = 4,
    LANDED = 5,
    ABORTED = 6,
}

/** Attitude quaternion (x, y, z, w) as used by the firmware's Eigen::Quaternionf. */
export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/** Mirrors the firmware's ControlPID::PIDParameters (controlPID/ControlPID.hpp). */
export interface PIDParameters {
    kp: number;
    ki: number;
    kd: number;
}

/** Mirrors the firmware's FlightProfile (stateManagement/FlightStateManager.hpp). */
export interface FlightProfile {
    countdownDuration_ms: number;
    motorBurnDuration_ms: number;
    initialRotation: Quaternion;
    targetAngle: Quaternion;
    pidKp: number;
    pidKi: number;
    pidKd: number;
    motorIgniterChannel: number;
    parachutePyroChannel: number;
    initialHeight_m: number;
}

type SendMessage = (
    messageType: MessageType,
    payload?: Uint8Array,
) => Promise<{ status: ResponseStatus; payload?: Uint8Array }>;

interface UseRadioCommandsOptions {
    sendMessage: SendMessage;
}

function toDataView(payload: Uint8Array): DataView {
    return new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
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

const FIXED_POINT_SCALE = 100;

// Quaternions travel as (x, y, z, w), each an int32 fixed-point value scaled by 100.
function encodeQuaternion(view: DataView, offset: number, quaternion: Quaternion): void {
    view.setInt32(offset + 0, quaternion.x * FIXED_POINT_SCALE, true);
    view.setInt32(offset + 4, quaternion.y * FIXED_POINT_SCALE, true);
    view.setInt32(offset + 8, quaternion.z * FIXED_POINT_SCALE, true);
    view.setInt32(offset + 12, quaternion.w * FIXED_POINT_SCALE, true);
}

function decodeQuaternion(data: DataView, offset: number): Quaternion {
    return {
        x: data.getInt32(offset + 0, true) / FIXED_POINT_SCALE,
        y: data.getInt32(offset + 4, true) / FIXED_POINT_SCALE,
        z: data.getInt32(offset + 8, true) / FIXED_POINT_SCALE,
        w: data.getInt32(offset + 12, true) / FIXED_POINT_SCALE,
    };
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
        const view = new DataView(payload.buffer);
        view.setInt16(0, degX * 100, true);
        view.setInt16(2, degY * 100, true);
        await sendMessage(MessageType.SET_GIMBAL, payload);
    };

    const getGimbal = async (): Promise<GimbalData> => {
        const response = await sendMessage(MessageType.GET_GIMBAL);

        if (!response.payload || response.payload.byteLength < 4) {
            throw new Error("GET_GIMBAL response has an invalid payload");
        }

        const data = toDataView(response.payload);
        return {
            degX_deg: data.getInt16(0, true) / 100,
            degY_deg: data.getInt16(2, true) / 100,
        };
    };

    const beepBuzzer = async (): Promise<void> => {
        await sendMessage(MessageType.DO_BEEP);
    };

    const firePyroChanel = async (channel: number, durationMs?: number): Promise<void> => {
        let payload: Uint8Array;
        if (durationMs === undefined) {
            payload = new Uint8Array([channel]);
        } else {
            payload = new Uint8Array(3);
            const view = new DataView(payload.buffer);
            view.setUint8(0, channel);
            view.setUint16(1, durationMs, true);
        }
        await sendMessage(MessageType.FIRE_PYRO, payload);
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
        await sendMessage(MessageType.SET_PYRO_SOFTWARE_ARMED, new Uint8Array([armed ? 1 : 0]));
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

        const data = toDataView(response.payload);
        return {
            accelX_m_s2: data.getInt16(0, true) / 100,
            accelY_m_s2: data.getInt16(2, true) / 100,
            accelZ_m_s2: data.getInt16(4, true) / 100,
            gyroX_rad_s: data.getInt16(6, true) / 100,
            gyroY_rad_s: data.getInt16(8, true) / 100,
            gyroZ_rad_s: data.getInt16(10, true) / 100,
        };
    };

    const getBaro = async (): Promise<BaroData> => {
        const response = await sendMessage(MessageType.GET_BAROMETER);

        if (!response.payload || response.payload.byteLength < 8) {
            throw new Error("GET_BARO response has an invalid payload");
        }

        const data = toDataView(response.payload);
        return {
            pressure_Pa: data.getInt32(0, true) / 100,
            temperature_C: data.getInt32(4, true) / 100,
        };
    };

    const getRotation = async (): Promise<RotationData> => {
        const response = await sendMessage(MessageType.GET_ROTATION);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_ROTATION response has an invalid payload");
        }

        const data = toDataView(response.payload);
        return {
            roll_rad: data.getInt32(0, true) / 100,
            pitch_rad: data.getInt32(4, true) / 100,
            yaw_rad: data.getInt32(8, true) / 100,
        };
    };

    const setRotation = async (roll_rad: number, pitch_rad: number, yaw_rad: number): Promise<void> => {
        const payload = new Uint8Array(12);
        const view = new DataView(payload.buffer);
        view.setInt32(0, roll_rad * 100, true);
        view.setInt32(4, pitch_rad * 100, true);
        view.setInt32(8, yaw_rad * 100, true);
        await sendMessage(MessageType.SET_ROTATION, payload);
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

        return toDataView(response.payload).getInt32(0, true) / 100;
    };

    // Re-bases the barometric height so the current measurement reads `height_m`
    // (0 on the launch pad). Throws if the firmware has no valid measurement yet.
    const calibrateBaroHeight = async (height_m: number): Promise<void> => {
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setInt32(0, height_m * 100, true);
        const response = await sendMessage(MessageType.CALIBRATE_BARO_HEIGHT, payload);
        ensureSuccess(response.status, "CALIBRATE_BARO_HEIGHT");
    };

    const getFlightLocation = async (): Promise<FlightLocationData> => {
        const response = await sendMessage(MessageType.GET_FLIGHT_LOCATION);

        if (!response.payload || response.payload.byteLength < 24) {
            throw new Error("GET_FLIGHT_LOCATION response has an invalid payload");
        }

        const data = toDataView(response.payload);
        return {
            posX_m: data.getInt32(0, true) / 100,
            posY_m: data.getInt32(4, true) / 100,
            velX_m_s: data.getInt32(8, true) / 100,
            velY_m_s: data.getInt32(12, true) / 100,
            height_m: data.getInt32(16, true) / 100,
            verticalVelocity_m_s: data.getInt32(20, true) / 100,
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

        return toDataView(response.payload).getUint32(0, true);
    };

    // Omitting durationMs flashes with the LED's default duration.
    // Throws if a duration was given but is 0.
    const flashLed = async (durationMs?: number): Promise<void> => {
        let payload: Uint8Array | undefined;
        if (durationMs !== undefined) {
            payload = new Uint8Array(2);
            const view = new DataView(payload.buffer);
            view.setUint16(0, durationMs, true);
        }
        const response = await sendMessage(MessageType.FLASH_LED, payload);
        ensureSuccess(response.status, "FLASH_LED");
    };

    // Starts the launch countdown; throws if the firmware refuses (not IDLE or preflight failed).
    // See FlightProfile for the countdown/burn durations, attitude, PID gains, pyro channels and start height.
    const startCountdown = async (profile: FlightProfile): Promise<void> => {
        const payload = new Uint8Array(58);
        const view = new DataView(payload.buffer);
        view.setUint32(0, profile.countdownDuration_ms, true);
        view.setUint32(4, profile.motorBurnDuration_ms, true);
        encodeQuaternion(view, 8, profile.initialRotation);
        encodeQuaternion(view, 24, profile.targetAngle);
        view.setInt32(40, profile.pidKp * FIXED_POINT_SCALE, true);
        view.setInt32(44, profile.pidKi * FIXED_POINT_SCALE, true);
        view.setInt32(48, profile.pidKd * FIXED_POINT_SCALE, true);
        view.setUint8(52, profile.motorIgniterChannel);
        view.setUint8(53, profile.parachutePyroChannel);
        view.setInt32(54, profile.initialHeight_m * FIXED_POINT_SCALE, true);
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
        const view = new DataView(payload.buffer);
        view.setInt32(0, kp * FIXED_POINT_SCALE, true);
        view.setInt32(4, ki * FIXED_POINT_SCALE, true);
        view.setInt32(8, kd * FIXED_POINT_SCALE, true);
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

        const data = toDataView(response.payload);
        return {
            kp: data.getInt32(0, true) / FIXED_POINT_SCALE,
            ki: data.getInt32(4, true) / FIXED_POINT_SCALE,
            kd: data.getInt32(8, true) / FIXED_POINT_SCALE,
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
        const payload = new Uint8Array(16);
        const view = new DataView(payload.buffer);
        encodeQuaternion(view, 0, target);
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

        if (!response.payload || response.payload.byteLength < 16) {
            throw new Error("GET_PID_TARGET response has an invalid payload");
        }

        return decodeQuaternion(toDataView(response.payload), 0);
    };

    const getBatteryVoltage = async (): Promise<number> => {
        const response = await sendMessage(MessageType.GET_BATTERY_VOLTAGE);

        if (!response.payload || response.payload.byteLength < 2) {
            throw new Error("GET_BATTERY_VOLTAGE response has an invalid payload");
        }

        return toDataView(response.payload).getInt16(0, true) / FIXED_POINT_SCALE;
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

