import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createParser, feed, take, encode, Packet, PacketType } from "./Protocol";

const PING_INTERVAL_MS = 500;

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;

    sendRadio: (data: number[]) => Promise<number[]>;
    sendAT: (command: string) => Promise<string>;

    sendRaw: (data: number[]) => Promise<void>;
    receiveRaw: () => Promise<number[]>;

    log: LogEntry[];
}

type DataDirection = "send" | "receive";
type LogEntry = { direction: DataDirection; data: number[]; ts: number };

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const failedPings = useRef(0);

    const sendAndLog = async (data: number[]) => {
        setLog((prev) => [...prev, { direction: "send", data, ts: Date.now() }]);
        await invoke("rocket_link_send", { data });
    }

    const receiveAndLog = async (): Promise<number[]> => {
        const data = await invoke<number[]>("rocket_link_read");
        if (data.length > 0) {
            setLog((prev) => [...prev, { direction: "receive", data, ts: Date.now() }]);
        }
        return data;
    }

    const sendPacket = async (packet: Packet) => {
        receiveAndLog(); // Clear any pending data before sending

        const encodedData = encode(packet);
        await sendAndLog(Array.from(encodedData));
    }

    const receivePacket = async (timeout_ms: number = 2000): Promise<Packet | null> => {
        const parser = createParser();
        let startTime = Date.now();
        let packet: Packet | null = null;
        while (Date.now() - startTime < timeout_ms) {
            const bytes = await receiveAndLog();
            for (const byte of bytes) {
                feed(parser, byte);
                packet = take(parser);
                if (packet) {
                    return packet;
                }
            }
        }

        return null; // Timeout reached without receiving a complete packet
    }

    
    const pingRocketLink = async () => {
        await sendPacket({ type: PacketType.PING, payload: new Uint8Array(0) });
        const packet = await receivePacket(2000); // 2s timeout
        
        if (!packet) throw new Error("No response packet received");
        if (packet.type !== PacketType.PONG) throw new Error(`Unexpected pong packet type: ${packet.type}`);
    }

    useEffect(() => {
        const id = setInterval(async () => {
            if (await invoke<boolean>("rocket_link_is_connected")) {
                const [isAlive, _] = await pingRocketLink().then(() => [true, null]).catch((e) => [false, e]);
                if (!isAlive) {
                    if (++failedPings.current >= 5) {
                        failedPings.current = 0;
                        await invoke("rocket_link_disconnect");
                        setConnected(false);
                        setPortName(null);
                    }
                } else {
                    failedPings.current = 0;
                    const port = await invoke<string>("rocket_link_get_port_name");
                    setPortName(port);
                    setConnected(true);
                }
            } else {
                setConnected(false);
                setPortName(null);
                try {
                    const port = await invoke<string>("rocket_link_connect");
                    setPortName(port);
                    setConnected(true);
                } catch (e) {

                }
            }
        }, PING_INTERVAL_MS);

        return () => clearInterval(id); // cleanup on unmount
    }, []);

    const sendRaw = async (data: number[]) => {
        await sendAndLog(data);
    }

    const receiveRaw = async (): Promise<number[]> => {
        return await receiveAndLog();
    }

    const sendRadio = async (data: number[]): Promise<number[]> => {
        await sendPacket({ type: PacketType.DATA, payload: new Uint8Array(data) });

        const packet = await receivePacket(2000); // 2s timeout

        if (!packet) throw new Error("No response packet received"); // This should never happen due to the while loop above
        if (packet.type !== PacketType.DATA) throw new Error(`Unexpected packet type: ${packet.type}`);
        return Array.from(packet.payload);
    }

    const sendAT = async (command: string): Promise<string> => {
        const commandBytes = new TextEncoder().encode(command);
        await sendPacket({ type: PacketType.AT_CMD, payload: commandBytes });

        const packet = await receivePacket(2000); // 2s timeout

        if (!packet) throw new Error("No response packet received"); // This should never happen due to the while loop above
        if (packet.type !== PacketType.AT_RESP) throw new Error(`Unexpected packet type: ${packet.type}`);
        return new TextDecoder().decode(packet.payload);
    }

    return (
        <RocketLinkContext.Provider value={{
            connected,
            portName,
            sendRadio: sendRadio,
            sendAT: sendAT,
            sendRaw: sendRaw,
            receiveRaw: receiveRaw,
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
