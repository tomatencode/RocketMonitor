import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";
import { useRadioCommands } from "./useRadioCommands";

export type { LogEntry };


interface RadioLinkContextValue extends ReturnType<typeof useRadioCommands> {
    connected: boolean;

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
        if (!connected || !usbConnected) {
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