import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { useRadioLink } from "../RadioLink/RadioLinkContext";
import type { IMUData, BaroData, RotationData, GimbalData, FlightLocationData, FlightState } from "../RadioLink/useRadioCommands";

/**
 * Polled telemetry topics. Each topic maps to the value returned by one GET_*
 * command, and is polled independently by the shared store.
 */
export interface RocketStatusTopics {
    imu: IMUData;
    baro: BaroData;
    rotation: RotationData;
    gimbal: GimbalData;
    baroHeight: number;
    flightLocation: FlightLocationData;
    flightState: FlightState;
    /** Remaining countdown ms; null while no countdown is active. */
    countdownTime: number | null;
}
export type RocketStatusTopic = keyof RocketStatusTopics;

/** Latest reading for a topic plus the last error, if any. */
export interface RocketStatusValue<T> {
    value: T | null;
    error: string | null;
}

type TopicPollers = { [K in RocketStatusTopic]: () => Promise<RocketStatusTopics[K]> };

/** Back-off before retrying a topic whose poll failed, so a dead link can't hot-loop. */
const ERROR_RETRY_MS = 250;

interface TopicEntry {
    poller: () => Promise<unknown>;
    value: unknown;
    snapshot: RocketStatusValue<unknown>;
    subscribers: number;
    /** Bumped to invalidate a running loop when it is stopped or restarted. */
    generation: number;
    listeners: Set<() => void>;
}

const EMPTY_SNAPSHOT: RocketStatusValue<never> = Object.freeze({ value: null, error: null });

/**
 * Framework-agnostic store: one demand-driven poll loop per topic. Consumers
 * subscribe through `useRocketStatus`; polling starts on the first subscriber
 * and stops on the last, so several components reading the same topic share a
 * single poll.
 */
class RocketStatusStore {
    private entries = new Map<RocketStatusTopic, TopicEntry>();

    constructor(private readonly getPollers: () => TopicPollers) {}

    subscribe = (topic: RocketStatusTopic, listener: () => void): (() => void) => {
        const entry = this.ensure(topic);
        entry.listeners.add(listener);
        entry.subscribers += 1;
        if (entry.subscribers === 1) this.start(entry);
        return () => {
            entry.listeners.delete(listener);
            entry.subscribers -= 1;
            if (entry.subscribers === 0) entry.generation += 1; // stops the loop
        };
    };

    getSnapshot = (topic: RocketStatusTopic): RocketStatusValue<unknown> =>
        this.entries.get(topic)?.snapshot ?? EMPTY_SNAPSHOT;

    dispose() {
        for (const entry of this.entries.values()) entry.generation += 1;
        this.entries.clear();
    }

    private ensure(topic: RocketStatusTopic): TopicEntry {
        let entry = this.entries.get(topic);
        if (!entry) {
            entry = {
                poller: () => this.getPollers()[topic](),
                value: null,
                snapshot: EMPTY_SNAPSHOT,
                subscribers: 0,
                generation: 0,
                listeners: new Set(),
            };
            this.entries.set(topic, entry);
        }
        return entry;
    }

    private start(entry: TopicEntry) {
        const generation = ++entry.generation;
        void (async () => {
            while (entry.generation === generation) {
                try {
                    const value = await entry.poller();
                    if (entry.generation !== generation) return;
                    this.publish(entry, value, null);
                } catch (e) {
                    if (entry.generation !== generation) return;
                    // Keep the last good reading; surface the error and back off.
                    this.publish(entry, entry.value, e instanceof Error ? e.message : String(e));
                    await new Promise((resolve) => setTimeout(resolve, ERROR_RETRY_MS));
                }
            }
        })();
    }

    private publish(entry: TopicEntry, value: unknown, error: string | null) {
        entry.value = value;
        entry.snapshot = { value, error };
        for (const listener of entry.listeners) listener();
    }
}

const RocketStatusContext = createContext<RocketStatusStore | null>(null);

/**
 * Provides the shared rocket-status store. Must be nested inside the
 * RadioLinkProvider (it polls through the radio commands).
 */
export function RocketStatusProvider({ children }: { children: React.ReactNode }) {
    const { getIMU, getBaro, getRotation, getGimbal, getBaroHeight, getFlightLocation, getFlightState, getCountdownTime } = useRadioLink();

    // Latest-ref pattern: the store reads the commands through this ref so it
    // doesn't need to be recreated when the command identities change.
    const pollersRef = useRef<TopicPollers | null>(null);
    pollersRef.current = {
        imu: getIMU,
        baro: getBaro,
        rotation: getRotation,
        gimbal: getGimbal,
        baroHeight: getBaroHeight,
        flightLocation: getFlightLocation,
        flightState: getFlightState,
        countdownTime: getCountdownTime,
    };

    const storeRef = useRef<RocketStatusStore | null>(null);
    if (!storeRef.current) storeRef.current = new RocketStatusStore(() => pollersRef.current!);

    useEffect(() => () => storeRef.current?.dispose(), []);

    return <RocketStatusContext.Provider value={storeRef.current}>{children}</RocketStatusContext.Provider>;
}

/**
 * Subscribe to a polled rocket-status topic. Starts/stops the shared poll loop
 * as subscribers come and go, and re-renders only when this topic updates.
 */
export function useRocketStatus<T extends RocketStatusTopic>(topic: T): RocketStatusValue<RocketStatusTopics[T]> {
    const store = useContext(RocketStatusContext);
    if (!store) throw new Error("useRocketStatus must be used within a RocketStatusProvider");

    const subscribe = useCallback(
        (onStoreChange: () => void) => store.subscribe(topic, onStoreChange),
        [store, topic],
    );
    const getSnapshot = useCallback(
        () => store.getSnapshot(topic) as RocketStatusValue<RocketStatusTopics[T]>,
        [store, topic],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
