import { createContext, useContext } from "react";
import { RocketCommander } from "./RocketCommander";

const RocketCommanderContext = createContext<RocketCommander | null>(null);

export function RocketCommanderProvider({ commander, children }: {
    commander: RocketCommander;
    children: React.ReactNode;
}) {
    return <RocketCommanderContext.Provider value={commander}>{children}</RocketCommanderContext.Provider>;
}

export function useRocketCommander() {
    const commander = useContext(RocketCommanderContext);
    if (!commander) throw new Error("useRocketCommander must be used within a RocketCommanderProvider");
    return commander;
}