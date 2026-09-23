import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PacketType } from "./Protocol";
import { usePacketTransport, LogEntry } from "./usePacketTransport";

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;
    hc12Alive: boolean;

    sendRadio: (data: number[]) => Promise<void>;
    onReceiveRadio: (callback: (data: number[]) => void) => () => void;
    sendAT: (command: string) => Promise<string>;

    log: LogEntry[];
}

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

// How often to ping the HC12 module with "AT" while USB-connected.
// Note the firmware puts the HC12 into AT mode for this (~400ms: enter+exit),
// during which radio TX/RX is blocked, so keep the interval generous.
const HC12_ALIVE_CHECK_INTERVAL_MS = 5000;

// The HC12 echoes "OK\r\n" for a bare "AT" ping.
function isHc12AtOk(response: string): boolean {
    return response.includes("OK");
}

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);
    // True while the HC12 has not proven dead: reset on (dis)connect, cleared on failed AT check.
    const [hc12Alive, setHc12Alive] = useState(true);

    const { log, sendAndReceivePacket, subscribeToPacketType} = usePacketTransport();

    const sendAndReceivePacketRef = useRef(sendAndReceivePacket);
    sendAndReceivePacketRef.current = sendAndReceivePacket;

    useEffect(() => {
        invoke("rocket_link_start_search");

        const unlistenFound = listen<string>("rocket-link-found", (e) => {
            setPortName(e.payload);
            setConnected(true);
            setHc12Alive(true); // assume alive until an AT check proves otherwise
        });
        const unlistenLost = listen("rocket-link-lost", () => {
            setConnected(false);
            setPortName(null);
            setHc12Alive(true); // reset so the icon goes gray, not red
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
        if (responsePacket.type !== PacketType.RADIO_SEND_QUEUED) throw new Error(`Unexpected packet type: ${responsePacket.type}`);
    }

    const onReceiveRadio = useCallback((callback: (data: number[]) => void) => {
        const unsubscribe = subscribeToPacketType(PacketType.RADIO_RECEIVED, (packet) => {
            callback(Array.from(packet.payload));
        });
        return unsubscribe;
    }, [subscribeToPacketType]);

    const sendAT = useCallback(async (command: string): Promise<string> => {
        const commandBytes = new TextEncoder().encode(command);


        const responsePacket = await sendAndReceivePacketRef.current({ type: PacketType.AT_CMD, payload: commandBytes }, 2000); // 2s timeout

        if (responsePacket.type !== PacketType.AT_RESP) throw new Error(`Unexpected packet type: ${responsePacket.type}`);
        return new TextDecoder().decode(responsePacket.payload);
    }, []);

    // Periodically verify the HC12 module is alive via an AT ping while USB-connected.
    // The firmware puts the HC12 into AT mode for this (~400ms: enter+exit), during
    // which radio TX/RX is blocked, so keep the interval generous.
    useEffect(() => {
        if (!connected) {
            setHc12Alive(true);
            return;
        }
        let cancelled = false;
        let checkInFlight = false;
        const checkHc12 = async () => {
            if (checkInFlight) return;
            checkInFlight = true;
            try {
                const response = await sendAT("AT");
                if (!cancelled && !isHc12AtOk(response)) {
                    setHc12Alive(false);
                }
            } catch {
                if (!cancelled) setHc12Alive(false);
            } finally {
                checkInFlight = false;
            }
        };
        void checkHc12();
        const intervalId = setInterval(checkHc12, HC12_ALIVE_CHECK_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [connected, sendAT]);

    return (
        <RocketLinkContext.Provider value={{
            connected,
            portName,
            hc12Alive,
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
