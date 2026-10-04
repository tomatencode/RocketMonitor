import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";
import { useRadioCommands, IMUData, BaroData, RotationData, GimbalData, FlightLocationData, FlightState, PIDParameters, Quaternion, FlightProfile } from "./useRadioCommands";

export type { LogEntry };


interface RadioLinkContextValue {
    connected: boolean;

    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    getGimbal: () => Promise<GimbalData>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number, durationMs?: number) => Promise<void>;
    getPyroContinuity: (channel: number) => Promise<boolean>;
    getPyroSoftwareArmed: () => Promise<boolean>;
    setPyroSoftwareArmed: (armed: boolean) => Promise<void>;
    getPyroHardwareArmed: () => Promise<boolean>;
    getIMU: () => Promise<IMUData>;
    getBaro: () => Promise<BaroData>;
    getRotation: () => Promise<RotationData>;
    setRotation: (roll_rad: number, pitch_rad: number, yaw_rad: number) => Promise<void>;
    abortFlight: () => Promise<void>;
    endFlight: () => Promise<void>;
    getBaroHeight: () => Promise<number>;
    calibrateBaroHeight: (height_m: number) => Promise<void>;
    getFlightLocation: () => Promise<FlightLocationData>;
    getFlightState: () => Promise<FlightState>;
    getCountdownTime: () => Promise<number | null>;
    flashLed: (durationMs?: number) => Promise<void>;
    startCountdown: (profile: FlightProfile) => Promise<void>;
    retryDeployParachute: () => Promise<void>;
    setPIDParameters: (kp: number, ki: number, kd: number) => Promise<void>;
    getPIDParameters: () => Promise<PIDParameters | null>;
    setControlling: (controlling: boolean) => Promise<void>;
    getControlling: () => Promise<boolean>;
    setPIDTarget: (target: Quaternion) => Promise<void>;
    getPIDTarget: () => Promise<Quaternion | null>;
    getBatteryVoltage: () => Promise<number>;

    log: LogEntry[];
}

const PING_INTERVAL_MS = 1000;

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { connected: usbConnected } = useRocketLink();
    const [connected, setConnected] = useState(true);
    const resetPingTimer = useRef<() => void>(() => {});
    const { log, sendMessage } = useMessageTransport(() => {
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
                await sendMessage(MessageType.PING);
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

    // Commands must fail fast while the link is down instead of queueing radio
    // traffic that can never be answered. The transport flushes the frame itself.
    const sendCommand = (messageType: MessageType, payload?: Uint8Array) => {
        if (!connected) {
            throw new Error("Not connected to the radio link");
        }
        return sendMessage(messageType, payload);
    };

    const commands = useRadioCommands({ sendMessage: sendCommand });

    return (
        <RadioLinkContext.Provider value={{
            connected: connected && usbConnected,

            ...commands,

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