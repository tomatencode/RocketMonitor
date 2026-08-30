import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createParser, feed, take, encode, Packet, PacketType } from "./Protocol";

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;

    sendRadio: (data: number[]) => Promise<void>;
    receiveRadio: (timeout_ms?: number) => Promise<number[]>;
    sendAT: (command: string) => Promise<string>;

    log: LogEntry[];
}

type DataDirection = "send" | "receive";
type LogEntry = { direction: DataDirection; ts: number } & (
    | { packet: Packet; data?: never }
    | { data: number[]; packet?: never }
);

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);


    const [log, setLog] = useState<LogEntry[]>([]);

    const mutex = useRef<Promise<void>>(Promise.resolve());

    const withMutex = <T,>(fn: () => Promise<T>): Promise<T> => {
        const result = mutex.current.then(() => fn());
        mutex.current = result.then(() => {}, () => {});
        return result;
    };

    const sendAndReceivePacket = (packet: Packet, timeout_ms: number = 500): Promise<Packet> =>
        withMutex(() => sendAndReceivePacketUnsafe(packet, timeout_ms));

    const sendAndReceivePacketUnsafe = async (packet: Packet, timeout_ms: number = 500): Promise<Packet> => {
        // Read any pending data to clear the buffer
        const data = await invoke<number[]>("rocket_link_read");
        if (data.length > 0) {
            setLog((prev) => [...prev, { direction: "receive", data, ts: Date.now() }]);
        }

        const encodedData = encode(packet);
        setLog((prev) => [...prev, { direction: "send", packet, ts: Date.now() }]);
        await invoke("rocket_link_send", { data: encodedData });

        const parser = createParser();
        let startTime = Date.now();
        let receivedPacket: Packet | null = null;
        while (Date.now() - startTime < timeout_ms) {
            const bytes = await invoke<number[]>("rocket_link_read");
            for (const byte of bytes) {
                feed(parser, byte);
                receivedPacket = take(parser);
                if (receivedPacket) {
                    const pkt = receivedPacket;
                    setLog((prev) => [...prev, { direction: "receive", packet: pkt, ts: Date.now() }]);
                    return pkt;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
        }

        const receivedBytes = Array.from(parser.pending.payload.subarray(0, parser.pendingPayloadLen));
        setLog((prev) => [...prev, { direction: "receive", data: receivedBytes, ts: Date.now() }]);

        throw new Error("Timeout reached without receiving a complete packet");
    }


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
