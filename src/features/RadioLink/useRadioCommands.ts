import { MessageType } from "./Protocol";
import { ResponseStatus } from "./useMessageTransport";

interface IMUData {
    accelX_m_s2: number;
    accelY_m_s2: number;
    accelZ_m_s2: number;
    gyroX_rad_s: number;
    gyroY_rad_s: number;
    gyroZ_rad_s: number;
}

interface BaroData {
    altitude: number;
    pressure: number;
    temperature: number;
}

interface RotationData {
    roll_rad: number;
    pitch_rad: number;
    yaw_rad: number;
}

export interface PositionData {
    x_m: number;
    y_m: number;
    z_m: number;
}

type QueueMessage = (
    messageType: MessageType,
    payload?: Uint8Array,
) => Promise<{ status: ResponseStatus; payload?: Uint8Array }>;

interface UseRadioCommandsOptions {
    queueMessage: QueueMessage;
    sendFrame: () => void;
    checkConnection: () => void;
}

export function useRadioCommands({
    queueMessage,
    sendFrame,
    checkConnection,
}: UseRadioCommandsOptions) {
    const queueSetGimbalPos = async (degX: number, degY: number): Promise<void> => {
        checkConnection();
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setInt16(0, degX * 100, true);
        view.setInt16(2, degY * 100, true);
        await queueMessage(MessageType.SET_GIMBAL, payload);
    };

    const setGimbalPos = async (degX: number, degY: number): Promise<void> => {
        checkConnection();
        const pending = queueSetGimbalPos(degX, degY);
        sendFrame();
        await pending;
    };

    const queueBeepBuzzer = async (): Promise<void> => {
        checkConnection();
        await queueMessage(MessageType.DO_BEEP);
    };

    const beepBuzzer = async (): Promise<void> => {
        checkConnection();
        const pending = queueBeepBuzzer();
        sendFrame();
        await pending;
    };

    const queueFirePyroChanel = async (channel: number): Promise<void> => {
        checkConnection();
        await queueMessage(MessageType.FIRE_PYRO, new Uint8Array([channel]));
    };

    const firePyroChanel = async (channel: number): Promise<void> => {
        checkConnection();
        const pending = queueFirePyroChanel(channel);
        sendFrame();
        await pending;
    };

    const requestIMU = async (): Promise<IMUData> => {
        checkConnection();
        const response = await queueMessage(MessageType.GET_IMU);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_IMU response has an invalid payload");
        }

        const data = new DataView(
            response.payload.buffer,
            response.payload.byteOffset,
            response.payload.byteLength,
        );
        return {
            accelX_m_s2: data.getInt16(0, true) / 1000,
            accelY_m_s2: data.getInt16(2, true) / 1000,
            accelZ_m_s2: data.getInt16(4, true) / 1000,
            gyroX_rad_s: data.getInt16(6, true) / 1000,
            gyroY_rad_s: data.getInt16(8, true) / 1000,
            gyroZ_rad_s: data.getInt16(10, true) / 1000,
        };
    };

    const getIMU = async (): Promise<IMUData> => {
        checkConnection();
        const pending = requestIMU();
        sendFrame();
        return await pending;
    };

    const requestBaro = async (): Promise<BaroData> => {
        checkConnection();
        const response = await queueMessage(MessageType.GET_BARO);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_BARO response has an invalid payload");
        }

        const data = new DataView(
            response.payload.buffer,
            response.payload.byteOffset,
            response.payload.byteLength,
        );
        return {
            altitude: data.getInt32(0, true) / 100,
            pressure: data.getInt32(4, true) / 100,
            temperature: data.getInt32(8, true) / 100,
        };
    };

    const getBaro = async (): Promise<BaroData> => {
        checkConnection();
        const pending = requestBaro();
        sendFrame();
        return await pending;
    };

    const requestRotation = async (): Promise<RotationData> => {
        checkConnection();
        const response = await queueMessage(MessageType.GET_ROTATION);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_ROTATION response has an invalid payload");
        }

        const data = new DataView(
            response.payload.buffer,
            response.payload.byteOffset,
            response.payload.byteLength,
        );
        return {
            roll_rad: data.getInt32(0, true) / 100,
            pitch_rad: data.getInt32(4, true) / 100,
            yaw_rad: data.getInt32(8, true) / 100,
        };
    };

    const getRotation = async (): Promise<RotationData> => {
        checkConnection();
        const pending = requestRotation();
        sendFrame();
        return await pending;
    };

    const queueSetRotation = async (roll_rad: number, pitch_rad: number, yaw_rad: number): Promise<void> => {
        checkConnection();
        const payload = new Uint8Array(12);
        const view = new DataView(payload.buffer);
        view.setInt32(0, roll_rad * 100, true);
        view.setInt32(4, pitch_rad * 100, true);
        view.setInt32(8, yaw_rad * 100, true);
        await queueMessage(MessageType.SET_ROTATION, payload);
        sendFrame();
    };

    const setRotation = async (roll_rad: number, pitch_rad: number, yaw_rad: number): Promise<void> => {
        checkConnection();
        const pending = queueSetRotation(roll_rad, pitch_rad, yaw_rad);
        sendFrame();
        return await pending;
    };

    const requestPosition = async (): Promise<PositionData> => {
        checkConnection();
        const response = await queueMessage(MessageType.GET_POSITION);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_POSITION response has an invalid payload");
        }

        const data = new DataView(
            response.payload.buffer,
            response.payload.byteOffset,
            response.payload.byteLength,
        );
        return {
            x_m: data.getInt32(0, true) / 100,
            y_m: data.getInt32(4, true) / 100,
            z_m: data.getInt32(8, true) / 100,
        };
    };

    const getPosition = async (): Promise<PositionData> => {
        checkConnection();
        const pending = requestPosition();
        sendFrame();
        return await pending;
    };

    const queueSetPosition = async (x_m: number, y_m: number, z_m: number): Promise<void> => {
        checkConnection();
        const payload = new Uint8Array(12);
        const view = new DataView(payload.buffer);
        view.setInt32(0, x_m * 100, true);
        view.setInt32(4, y_m * 100, true);
        view.setInt32(8, z_m * 100, true);
        await queueMessage(MessageType.SET_POSITION, payload);
    };

    const setPosition = async (x_m: number, y_m: number, z_m: number): Promise<void> => {
        checkConnection();
        const pending = queueSetPosition(x_m, y_m, z_m);
        sendFrame();
        await pending;
    };

    return {
        queueSetGimbalPos,
        queueBeepBuzzer,
        queueFirePyroChanel,
        requestIMU,
        requestBaro,
        requestRotation,
        requestPosition,
        queueSetRotation,
        queueSetPosition,
        setGimbalPos,
        beepBuzzer,
        firePyroChanel,
        getIMU,
        getBaro,
        getRotation,
        getPosition,
        setRotation,
        setPosition,
    };
}