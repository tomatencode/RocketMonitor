import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useState } from "react";

const PING_INTERVAL_MS = 500;

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;
    send: (data: number[]) => Promise<void>;
    receive: () => Promise<number[]>;
}

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);

    useEffect(() => {
        const id = setInterval(async () => {
            if (await invoke<boolean>("rocket_link_is_connected")) {
                const [isAlive, _] = await invoke<[boolean, string | null]>("rocket_link_ping");
                if (!isAlive) {
                    await invoke("rocket_link_disconnect");
                    setConnected(false);
                    setPortName(null);
                } else {
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

    return (
        <RocketLinkContext.Provider value={{
            connected,
            portName,
            send: (data) => invoke("rocket_link_send", { data }),
            receive: () => invoke<number[]>("rocket_link_read"),
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
