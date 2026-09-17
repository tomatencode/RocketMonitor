import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";

export type { LogEntry };

interface RadioLinkContextValue {
    connected: boolean;

    queueSetGimbalPos: (degX: number, degY: number) => Promise<void>;
    queueBeepBuzzer: () => Promise<void>;
    queueFirePyroChanel: (channel: number) => Promise<void>;

    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number) => Promise<void>;

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

    return (
        <RadioLinkContext.Provider value={{
            connected: connected && usbConnected,

            queueSetGimbalPos: queueSetGimbalPos,
            queueBeepBuzzer: queueBeepBuzzer,
            queueFirePyroChanel: queueFirePyroChanel,

            setGimbalPos: setGimbalPos,
            beepBuzzer: beepBuzzer,
            firePyroChanel: firePyroChanel,

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