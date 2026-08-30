import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useState } from "react";
import { PacketType } from "./Protocol";
import { usePacketTransport, LogEntry } from "./usePacketTransport";

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;

    sendRadio: (data: number[]) => Promise<void>;
    receiveRadio: (timeout_ms?: number) => Promise<number[]>;
    sendAT: (command: string) => Promise<string>;

    log: LogEntry[];
}

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);

    const { log, sendAndReceivePacket } = usePacketTransport();

    useEffect(() => {
        invoke("rocket_link_start_search");

        const unlistenFound = listen<string>("rocket-link-found", (e) => {
            setPortName(e.payload);
            setConnected(true);
        });
        const unlistenLost = listen("rocket-link-lost", () => {
            setConnected(false);
            setPortName(null);
        });

        return () => {
            invoke("rocket_link_stop_search");
            unlistenFound.then((fn) => fn());
            unlistenLost.then((fn) => fn());
        };
    }, []);

    const sendRadio = async (data: number[]) => {
        const packet = { type: PacketType.SEND_RADIO_REQ, payload: new Uint8Array(data) };
        const responsePacket = await sendAndReceivePacket(packet);
        if (responsePacket.type !== PacketType.SEND_RADIO_ACK) throw new Error(`Unexpected packet type: ${responsePacket.type}`);
    }

    const receiveRadio = async (timeout_ms: number = 2000): Promise<number[]> => {
        const packet = { type: PacketType.RECEIVE_RADIO_REQ, payload: new Uint8Array(0) };
        const responsePacket = await sendAndReceivePacket(packet, timeout_ms);
        if (responsePacket.type !== PacketType.RECEIVE_RADIO_RESP) throw new Error(`Unexpected packet type: ${responsePacket.type}`);
        return Array.from(responsePacket.payload);
    }

    const sendAT = async (command: string): Promise<string> => {
        const commandBytes = new TextEncoder().encode(command);


        const responsePacket = await sendAndReceivePacket({ type: PacketType.AT_CMD, payload: commandBytes }, 2000); // 2s timeout

        if (!responsePacket) throw new Error("No response packet received"); // This should never happen due to the while loop above
        if (responsePacket.type !== PacketType.AT_RESP) throw new Error(`Unexpected packet type: ${responsePacket.type}`);
        return new TextDecoder().decode(responsePacket.payload);
    }

    return (
        <RocketLinkContext.Provider value={{
            connected,
            portName,
            sendRadio: sendRadio,
            receiveRadio: receiveRadio,
            sendAT: sendAT,
            log,
        }}>
            {children}
        </RocketLinkContext.Provider>
    );
}

export function useRocketLink() {
    const ctx = useContext(RocketLinkContext);
    if (!ctx) throw new Error("useRocketLink must be used within a RocketLinkProvider");
    return ctx;
}
