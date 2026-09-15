import { createContext, useContext } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { MessageType } from "./Protocol";
import { useMessageTransport, LogEntry } from "./useMessageTransport";

export type { LogEntry };

interface RadioLinkContextValue {
    connected: boolean;
    
    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number) => Promise<void>;

    log: LogEntry[];
}

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { connected: rocketConnected } = useRocketLink();
    const { log, queueCommand } = useMessageTransport();

    const setGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setInt16(0, degX, true);
        view.setInt16(2, degY, true);
        await queueCommand({ type: MessageType.SET_GIMBAL, payload });
    }

    const beepBuzzer = async (): Promise<void> => {
        await queueCommand({ type: MessageType.DO_BEEP, payload: new Uint8Array() });
    }

    const firePyroChanel = async (channel: number): Promise<void> => {
        await queueCommand({ type: MessageType.FIRE_PYRO, payload: new Uint8Array([channel]) });
    }

    return (
        <RadioLinkContext.Provider value={{
            connected: rocketConnected,
            setGimbalPos: setGimbalPos,
            beepBuzzer: beepBuzzer,
            firePyroChanel: firePyroChanel,
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