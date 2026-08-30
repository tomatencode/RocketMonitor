import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useState } from "react";
import { PacketType } from "./Protocol";
import { usePacketTransport, LogEntry } from "./usePacketTransport";

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;

    sendRadio: (data: number[]) => Promise<void>;
    onReceiveRadio: (callback: (data: number[]) => void) => () => void;
    sendAT: (command: string) => Promise<string>;

    log: LogEntry[];
}

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);

    const { log, sendAndReceivePacket, pushListeners } = usePacketTransport();

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
        const packet = { type: PacketType.RADIO_SEND, payload: new Uint8Array(data) };
        const responsePacket = await sendAndReceivePacket(packet);
        if (responsePacket.type !== PacketType.RADIO_SEND_ACK) throw new Error(`Unexpected packet type: ${responsePacket.type}`);
    }

    const onReceiveRadio = (callback: (data: number[]) => void) => {
        pushListeners.current.set(PacketType.RADIO_RECEIVED, (pkt) => {
            callback(Array.from(pkt.payload));
        });
        return () => {
            pushListeners.current.delete(PacketType.RADIO_RECEIVED);
        };
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
            onReceiveRadio: onReceiveRadio,
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
