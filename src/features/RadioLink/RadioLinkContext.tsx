import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";

export type { LogEntry };

interface IMUData {
    accelX_m_s2: number;
    accelY_m_s2: number;
    accelZ_m_s2: number;
    gyroX_rad_s: number;
    gyroY_rad_s: number;
    gyroZ_rad_s: number;
}

interface RadioLinkContextValue {
    connected: boolean;

    queueSetGimbalPos: (degX: number, degY: number) => Promise<void>;
    queueBeepBuzzer: () => Promise<void>;
    queueFirePyroChanel: (channel: number) => Promise<void>;
    queueGetIMU: () => Promise<IMUData>;

    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number) => Promise<void>;
    getIMU: () => Promise<IMUData>;

    sendQueuedCommands: () => void;

    log: LogEntry[];
}

const PING_INTERVAL_MS = 1000;

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { connected: usbConnected } = useRocketLink();
    const [connected, setConnected] = useState(true);
    const resetPingTimer = useRef<() => void>(() => {});
    const { log, queueMessage, sendFrame } = useMessageTransport(() => {
        setConnected(true);
        resetPingTimer.current();
    });

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const schedulePing = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(sendPing, PING_INTERVAL_MS);
        };

        const sendPing = async () => {
            if (!usbConnected) {
                setConnected(false);
                schedulePing();
                return;
            }
            try {
                const pending = queueMessage(MessageType.PING);
                sendFrame();
                await pending;
                setConnected(true);
            } catch (error) {
                setConnected(false);
            } finally {
                schedulePing();
            }
        };

        resetPingTimer.current = schedulePing;
        schedulePing();

        return () => {
            clearTimeout(timeoutId);
            resetPingTimer.current = () => {};
        };
    }, [usbConnected]);

    const queueSetGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setInt16(0, degX, true);
        view.setInt16(2, degY, true);
        await queueMessage(MessageType.SET_GIMBAL, payload);
    }

    const setGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const pending = queueSetGimbalPos(degX, degY);
        sendQueuedCommands();
        await pending;
    }

    const queueBeepBuzzer = async (): Promise<void> => {
        await queueMessage(MessageType.DO_BEEP);
    }

    const beepBuzzer = async (): Promise<void> => {
        const pending = queueBeepBuzzer();
        sendQueuedCommands();
        await pending;
    }

    const queueFirePyroChanel = async (channel: number): Promise<void> => {
        await queueMessage(MessageType.FIRE_PYRO, new Uint8Array([channel]));
    }

    const firePyroChanel = async (channel: number): Promise<void> => {
        const pending = queueFirePyroChanel(channel);
        sendQueuedCommands();
        await pending;
    }

    const sendQueuedCommands = () => {
        sendFrame();
    }

    const queueGetIMU = async (): Promise<IMUData> => {
        const response = await queueMessage(MessageType.GET_IMU);

        if (!response.payload || response.payload.byteLength < 12) {
            throw new Error("GET_IMU response has an invalid payload");
        }

        const data = new DataView(
            response.payload.buffer,
            response.payload.byteOffset,
            response.payload.byteLength,
        );
        const imuData: IMUData = {
            accelX_m_s2: data.getInt16(0, true) / 1000,
            accelY_m_s2: data.getInt16(2, true) / 1000,
            accelZ_m_s2: data.getInt16(4, true) / 1000,
            gyroX_rad_s: data.getInt16(6, true) / 1000,
            gyroY_rad_s: data.getInt16(8, true) / 1000,
            gyroZ_rad_s: data.getInt16(10, true) / 1000,
        };
        return imuData;
    }

    const getIMU = async (): Promise<IMUData> => {
        const pending = queueGetIMU();
        sendQueuedCommands();
        const imuData = await pending;
        return imuData;
    }

    return (
        <RadioLinkContext.Provider value={{
            connected: connected && usbConnected,

            queueSetGimbalPos: queueSetGimbalPos,
            queueBeepBuzzer: queueBeepBuzzer,
            queueFirePyroChanel: queueFirePyroChanel,
            queueGetIMU: queueGetIMU,

            setGimbalPos: setGimbalPos,
            beepBuzzer: beepBuzzer,
            firePyroChanel: firePyroChanel,
            getIMU: getIMU,

            sendQueuedCommands: sendQueuedCommands,

            log,
        }}>
            {children}
        </RadioLinkContext.Provider>
    );
}

export function useRadioLink() {
    const ctx = useContext(RadioLinkContext);
    if (!ctx) throw new Error("useRadioLink must be used within a RadioLinkProvider");
    return ctx;
}