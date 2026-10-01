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
    };
}

