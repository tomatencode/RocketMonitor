import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { createParser, encode, feed, take, Packet, PacketType, EXPECTED_RESPONSE } from "./Protocol";

type DataDirection = "send" | "receive";
export type LogEntry = { direction: DataDirection; ts: number } & (
    | { packet: Packet; data?: never }
    | { data: number[]; packet?: never }
);

const MAX_LOG_ENTRIES = 1000;

export function usePacketTransport() {
    const [log, setLog] = useState<LogEntry[]>([]);

    const typeMutexes = useRef<Map<PacketType, Promise<void>>>(new Map());
    const pendingRequests = useRef<Map<PacketType, (p: Packet) => void>>(new Map());
    const pushListeners = useRef<Map<PacketType, ((p: Packet) => void)[]>>(new Map());

    const addLogEntry = (entry: LogEntry) => {
        setLog((prev) => {
            const newLog = [...prev, entry];
            if (newLog.length > MAX_LOG_ENTRIES) newLog.shift();
            return newLog;
        });
    };

    useEffect(() => {
        let running = true;
        const parser = createParser();

        async function loop() {
            while (running) {
                try {
                    const bytes = await invoke<number[]>("rocket_link_read");
                    for (const byte of bytes) {
                        feed(parser, byte);
                        const pkt = take(parser);
                        if (!pkt) continue;

                        addLogEntry({ direction: "receive", packet: pkt, ts: Date.now() });

                        const resolver = pendingRequests.current.get(pkt.type);
                        if (resolver) {
                            pendingRequests.current.delete(pkt.type);
                            resolver(pkt);
                        } else {
                            pushListeners.current.get(pkt.type)?.forEach((listener) => listener(pkt));
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
        addLogEntry({ direction: "send", packet, ts: Date.now() });
        await invoke("rocket_link_send", { data: encodedData });
    };

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

    return { log, sendPacket, sendAndReceivePacket, pushListeners };
}
