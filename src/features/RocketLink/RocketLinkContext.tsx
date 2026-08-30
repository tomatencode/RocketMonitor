import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createParser, feed, take, encode, Packet, PacketType, EXPECTED_RESPONSE } from "./Protocol";

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

    const typeMutexes = useRef<Map<PacketType, Promise<void>>>(new Map());

    // Resolvers waiting for a specific response type
    const pendingRequests = useRef<Map<PacketType, (p: Packet) => void>>(new Map());
    // Listeners for unsolicited push packets
    const pushListeners = useRef<Map<PacketType, (p: Packet) => void>>(new Map());

    useEffect(() => {
        let running = true;
        const parser = createParser(); // one parser for the lifetime of the connection

        async function loop() {
            while (running) {
                try {
                    const bytes = await invoke<number[]>("rocket_link_read");
                    for (const byte of bytes) {
                        feed(parser, byte);
                        const pkt = take(parser);
                        if (!pkt) continue;

                        setLog((prev) => [...prev, { direction: "receive", packet: pkt, ts: Date.now() }]);

                        const resolver = pendingRequests.current.get(pkt.type);
                        if (resolver) {
                            pendingRequests.current.delete(pkt.type);
                            resolver(pkt);
                        } else {
                            pushListeners.current.get(pkt.type)?.(pkt);
                        }
                    }
                } catch { /* not connected */ }
                await new Promise(r => setTimeout(r, 5));
            }
        }
        loop();
        return () => { running = false; };
    }, []);

    const sendPacket = async (packet: Packet) => {
        const encodedData = encode(packet);
        setLog((prev) => [...prev, { direction: "send", packet, ts: Date.now() }]);
        await invoke("rocket_link_send", { data: encodedData });
    }

    const sendAndReceivePacket = (packet: Packet, timeout_ms = 500): Promise<Packet> => {
        const responseType = EXPECTED_RESPONSE[packet.type];
        if (!responseType) return Promise.reject(new Error(`No expected response type for packet type ${packet.type}`));

        const prev = typeMutexes.current.get(responseType) ?? Promise.resolve();
        const result = prev.then(() => new Promise<Packet>((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingRequests.current.delete(responseType);
                reject(new Error("Timeout"));
            }, timeout_ms);

            pendingRequests.current.set(responseType, (pkt) => {
                clearTimeout(timer);
                resolve(pkt);
            });

            sendPacket(packet);
        }));
        typeMutexes.current.set(responseType, result.then(() => {}, () => {}));
        return result;
    };

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
