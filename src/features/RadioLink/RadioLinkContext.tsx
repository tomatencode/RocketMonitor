import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";
import { useRadioCommands } from "./useRadioCommands";
import { DownloadTrafficGate } from "./DownloadTrafficGate";
import type { DownloadTrafficControl } from "../RocketStatus/rocketTypes";

export type { LogEntry };


interface RadioLinkContextValue extends ReturnType<typeof useRadioCommands>, DownloadTrafficControl {
    connected: boolean;

    log: LogEntry[];
}

const PING_INTERVAL_MS = 1000;

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { connected: usbConnected } = useRocketLink();
    const [connected, setConnected] = useState(true);
    const resetPingTimer = useRef<() => void>(() => {});
    const traffic = useRef(new DownloadTrafficGate()).current;
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
            if (traffic.isDownloading()) {
                schedulePing();
                return;
            }
            try {
                await traffic.request(MessageType.PING, () => sendMessage(MessageType.PING));
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
        // A nearly 1 KB batched response takes >1 second at 9600 baud, before
        // HC12 turnaround and flash verification. Avoid premature duplicate retries.
        const timeout = messageType === MessageType.GET_LOG_BYTES ? 5000 : 500;
        return traffic.request(messageType, () => sendMessage(messageType, payload, timeout));
    };

    const commands = useRadioCommands({ sendMessage: sendCommand });

    return (
        <RadioLinkContext.Provider value={{
            connected: connected && usbConnected,
            acquireDownload: () => traffic.acquireDownload(),

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