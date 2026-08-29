import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useState } from "react";

interface RocketLinkContextValue {
    connected: boolean;
    portName: string | null;
    connect: () => Promise<string | null>;
    disconnect: () => Promise<void>;
    send: (data: number[]) => Promise<void>;
    receive: () => Promise<number[]>;
}

const RocketLinkContext = createContext<RocketLinkContextValue | null>(null);

export function RocketLinkProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);

    async function connect() {
        const port: string = await invoke("rocket_link_connect");
        setConnected(true);
        setPortName(port);
        return port;
    }

    async function disconnect() {
        await invoke("rocket_link_disconnect");
        setConnected(false);
        setPortName(null);
    }

    return (
        <RocketLinkContext.Provider value={{
            connected,
            portName,
            connect,
            disconnect,
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
