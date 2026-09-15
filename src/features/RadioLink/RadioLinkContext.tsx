import { createContext, useContext } from "react";
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

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { connected: rocketConnected } = useRocketLink();
    const { log, queueMessage, sendFrame } = useMessageTransport();

    const queueSetGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setInt16(0, degX, true);
        view.setInt16(2, degY, true);
        await queueMessage({ type: MessageType.SET_GIMBAL, payload });
    }

    const setGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const pending = queueSetGimbalPos(degX, degY);
        sendQueuedCommands();
        await pending;
    }

    const queueBeepBuzzer = async (): Promise<void> => {
        await queueMessage({ type: MessageType.DO_BEEP, payload: new Uint8Array() });
    }

    const beepBuzzer = async (): Promise<void> => {
        const pending = queueBeepBuzzer();
        sendQueuedCommands();
        await pending;
    }

    const queueFirePyroChanel = async (channel: number): Promise<void> => {
        await queueMessage({ type: MessageType.FIRE_PYRO, payload: new Uint8Array([channel]) });
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
            connected: rocketConnected,

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