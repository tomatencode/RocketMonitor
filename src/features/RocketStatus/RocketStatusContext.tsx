import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { RocketStatusStore, type RocketStatusTopic, type RocketStatusValue, type TopicValue } from "./RocketStatusStore";

export type { RocketStatusTopics, RocketStatusTopic, RocketStatusValue } from "./RocketStatusStore";

const RocketStatusContext = createContext<RocketStatusStore | null>(null);

/** Adapters provide a transport-independent store and own its connection lifecycle. */
export function RocketStatusProvider({ store, children }: { store: RocketStatusStore; children: React.ReactNode }) {
    return <RocketStatusContext.Provider value={store}>{children}</RocketStatusContext.Provider>;
}

export function useRocketStatusStore() {
    const store = useContext(RocketStatusContext);
    if (!store) throw new Error("Rocket status hooks must be used within a RocketStatusProvider");
    return store;
}

export function useRocketConnected(): boolean {
    const store = useRocketStatusStore();
    return useSyncExternalStore(store.subscribeConnection, store.getConnected, store.getConnected);
}

/** Shared demand-driven telemetry or session-cached configuration. */
export function useRocketStatus<K extends RocketStatusTopic>(topic: K): RocketStatusValue<TopicValue<K>> {
    const store = useRocketStatusStore();
    const subscribe = useCallback((listener: () => void) => store.subscribe(topic, listener), [store, topic]);
    const getSnapshot = useCallback(() => store.getSnapshot(topic), [store, topic]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to a variable channel list without calling hooks in a loop. */
export function useRocketPyroContinuity(channels: number[], enabled = true) {
    const store = useRocketStatusStore();
    const key = channels.join(",");
    const topics = useCallback(() => key === "" ? [] : key.split(",").map(
        channel => `pyroContinuity:${Number(channel)}` as const,
    ), [key]);
    const subscribe = useCallback((listener: () => void) => {
        const cleanups = enabled ? topics().map(topic => store.subscribe(topic, listener)) : [];
        return () => cleanups.forEach(cleanup => cleanup());
    }, [store, topics, enabled]);
    // Aggregate snapshot identity must remain stable until a channel changes.
    const getSnapshot = useCallback((() => {
        let previous: RocketStatusValue<boolean>[] = [];
        return () => {
            const next = topics().map(topic => store.getSnapshot(topic));
            if (next.length !== previous.length || next.some((snapshot, i) => snapshot !== previous[i])) previous = next;
            return previous;
        };
    })(), [store, topics]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}