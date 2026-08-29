import { createContext, useEffect, useState } from "react";
import { useRocketLink } from "../RocketLink/RocketLinkContext";

interface RadioLinkContextValue {
    connected: boolean;
    setGimbalPos: (degX: number, degY: number) => Promise<boolean>;
}

const RadioLinkContext = createContext<RadioLinkContextValue | null>(null);

export function RadioLinkProvider({ children }: { children: React.ReactNode }) {
    const { sendRadio } = useRocketLink();
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const id = setInterval(async () => {
            // TODO: Ping Rocket
        }, 500);

        return () => clearInterval(id); // cleanup on unmount
    }, []);

    const setGimbalPos = async (degX: number, degY: number): Promise<boolean> => {
        return false; // TODO: Implement this function to send gimbal position commands via RocketLink
    }

    return (
        <RadioLinkContext.Provider value={{
            connected,
            setGimbalPos: setGimbalPos,
        }}>
            {children}
        </RadioLinkContext.Provider>
    );
}