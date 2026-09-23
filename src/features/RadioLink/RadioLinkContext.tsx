import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";
import { useRadioCommands } from "./useRadioCommands";

export type { LogEntry };

export interface IMUData {
    accelX_m_s2: number;
    accelY_m_s2: number;
    accelZ_m_s2: number;
    gyroX_rad_s: number;
    gyroY_rad_s: number;
    gyroZ_rad_s: number;
}

export interface BaroData {
    altitude: number;
    pressure: number;
    temperature: number;
}

interface RadioLinkContextValue {
    connected: boolean;

    queueSetGimbalPos: (degX: number, degY: number) => Promise<void>;
    queueBeepBuzzer: () => Promise<void>;
    queueFirePyroChanel: (channel: number, durationMs?: number) => Promise<void>;
    requestIMU: () => Promise<IMUData>;
    requestBaro: () => Promise<BaroData>;
    requestRotation: () => Promise<{ roll_rad: number; pitch_rad: number; yaw_rad: number }>;
    queueSetRotation: (roll_rad: number, pitch_rad: number, yaw_rad: number) => Promise<void>;
    requestPyroContinuity: (channel: number) => Promise<boolean>;
    requestPyroSoftwareArmed: () => Promise<boolean>;
    requestPyroHardwareArmed: () => Promise<boolean>;

    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number, durationMs?: number) => Promise<void>;
    getIMU: () => Promise<IMUData>;
    getBaro: () => Promise<BaroData>;
    getRotation: () => Promise<{ roll_rad: number; pitch_rad: number; yaw_rad: number }>;
    setRotation: (roll_rad: number, pitch_rad: number, yaw_rad: number) => Promise<void>;
    getPyroContinuity: (channel: number) => Promise<boolean>;
    getPyroSoftwareArmed: () => Promise<boolean>;
    getPyroHardwareArmed: () => Promise<boolean>;

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

    const checkConnection = () => {
        if (!connected) {
            throw new Error("Not connected to the radio link");
        }
    };

    const sendQueuedCommands = () => {
        checkConnection();
        sendFrame();
    };

    const commands = useRadioCommands({ queueMessage, sendFrame: sendQueuedCommands, checkConnection });


    return (
        <RadioLinkContext.Provider value={{
            connected: connected && usbConnected,

            ...commands,

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