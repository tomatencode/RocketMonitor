import { createContext, useContext, useEffect, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";
import { Packet, PacketType } from "./Protocol";

type DataDirection = "send" | "receive";
export type LogEntry = { direction: DataDirection; ts: number } & (
    | { packet: Packet; data?: never }
    | { data: number[]; packet?: never }
);


interface RadioLinkContextValue {
    connected: boolean;
    
    setGimbalPos: (degX: number, degY: number) => Promise<void>;
    beepBuzzer: () => Promise<void>;
    firePyroChanel: (channel: number) => Promise<void>;

    log: LogEntry[];
}

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { connected: rocketConnected, sendRadio, onReceiveRadio } = useRocketLink();
    const [log, setLog] = useState<LogEntry[]>([]);

    const addLogEntry = (entry: LogEntry) => {
        setLog((prev) => [...prev, entry].slice(-1000));
    };

    useEffect(() => {
        return onReceiveRadio((data) => {
            addLogEntry({ direction: "receive", data, ts: Date.now() });
        });
    }, [onReceiveRadio]);

    const setGimbalPos = async (degX: number, degY: number): Promise<void> => {
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setInt16(0, degX, true);
        view.setInt16(2, degY, true);
        addLogEntry({ direction: "send", packet: { type: PacketType.SET_GIMBAL_POS, payload }, ts: Date.now() });
        await sendRadio([PacketType.SET_GIMBAL_POS, ...payload]);
    }

    const beepBuzzer = async (): Promise<void> => {
        const payload = new Uint8Array();
        addLogEntry({ direction: "send", packet: { type: PacketType.BEEP_BUZZER, payload }, ts: Date.now() });
        await sendRadio([PacketType.BEEP_BUZZER]);
    }

    const firePyroChanel = async (channel: number): Promise<void> => {
        const payload = new Uint8Array([channel]);
        addLogEntry({ direction: "send", packet: { type: PacketType.FIRE_PYRO_CHANNEL, payload }, ts: Date.now() });
        await sendRadio([PacketType.FIRE_PYRO_CHANNEL, channel]);
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