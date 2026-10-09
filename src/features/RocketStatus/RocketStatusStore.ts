import type { RocketGetters } from "./rocketTypes";

type TopicName<Name extends string> = Name extends "IMU" ? "imu"
    : Name extends `PID${infer Rest}` ? `pid${Rest}` : Uncapitalize<Name>;

export type RocketStatusTopics = {
    [K in keyof RocketGetters as K extends `get${infer Name}` ? TopicName<Name> : never]:
        Awaited<ReturnType<RocketGetters[K]>>;
};

// Continuity is independently subscribed/polled for each channel, not a fixed channel list.
export type RocketStatusTopic = Exclude<keyof RocketStatusTopics, "pyroContinuity"> | `pyroContinuity:${number}`;
export type TopicValue<K extends RocketStatusTopic> = K extends keyof RocketStatusTopics
    ? RocketStatusTopics[K] : boolean;
export type TopicPollers = {
    [K in Exclude<keyof RocketStatusTopics, "pyroContinuity">]: () => Promise<RocketStatusTopics[K]>;
} & { pyroContinuity: (channel: number) => Promise<boolean> };

export interface RocketStatusValue<T> {
    value: T | null;
    error: string | null;
    /** True even when a successful getter returned null (e.g. unconfigured PID). */
    hasValue: boolean;
    lastUpdatedAt: number | null;
}

const EMPTY_SNAPSHOT: RocketStatusValue<never> = Object.freeze({
    value: null, error: null, hasValue: false, lastUpdatedAt: null,
});
const CACHED_TOPICS = new Set<RocketStatusTopic>([
    "pidParameters", "pidTarget", "controlling", "pyroSoftwareArmed", "logging",
]);
const ERROR_RETRY_MS = 250;
const HARDWARE_POLL_MS = 1500;

interface TopicEntry {
    topic: RocketStatusTopic;
    snapshot: RocketStatusValue<unknown>;
    listeners: Set<() => void>;
    revision: number;
    running: boolean;
    forceRead: boolean;
    timer?: ReturnType<typeof setTimeout>;
}

/** Transport-independent, demand-driven status cache. */
export class RocketStatusStore {
    private entries = new Map<RocketStatusTopic, TopicEntry>();
    private connected = false;
    private session = 0;
    private connectionListeners = new Set<() => void>();

    constructor(private readonly getPollers: () => TopicPollers) {}

    getSession = () => this.session;
    getConnected = () => this.connected;
    subscribeConnection = (listener: () => void) => {
        this.connectionListeners.add(listener);
        return () => { this.connectionListeners.delete(listener); };
    };

    setConnected(connected: boolean) {
        if (this.connected === connected) return;
        this.connected = connected;
        this.session += 1;
        for (const entry of this.entries.values()) {
            this.invalidate(entry);
            entry.forceRead = false;
            this.kick(entry);
        }
        for (const listener of this.connectionListeners) listener();
    }

    subscribe = (topic: RocketStatusTopic, listener: () => void): (() => void) => {
        const entry = this.ensure(topic);
        // Each subscription has its own wrapper, even if callers reuse a listener.
        const notify = () => listener();
        entry.listeners.add(notify);
        this.kick(entry);
        return () => {
            entry.listeners.delete(notify);
            if (entry.listeners.size === 0 && !entry.forceRead) {
                clearTimeout(entry.timer);
                entry.timer = undefined;
            }
        };
    };

    getSnapshot = <K extends RocketStatusTopic>(topic: K): RocketStatusValue<TopicValue<K>> =>
        (this.entries.get(topic)?.snapshot ?? EMPTY_SNAPSHOT) as RocketStatusValue<TopicValue<K>>;

    /** Invalidate old reads and request a one-shot readback, even without subscribers. */
    refresh = (...topics: RocketStatusTopic[]) => {
        for (const topic of topics) {
            const entry = this.ensure(topic);
            this.invalidate(entry);
            entry.forceRead = true;
            this.kick(entry);
        }
    };

    /** Reusable cleanup: preserves subscriptions for React StrictMode effect replay. */
    suspend() {
        this.setConnected(false);
    }

    private ensure(topic: RocketStatusTopic): TopicEntry {
        let entry = this.entries.get(topic);
        if (!entry) {
            entry = { topic, snapshot: EMPTY_SNAPSHOT, listeners: new Set(), revision: 0,
                running: false, forceRead: false };
            this.entries.set(topic, entry);
        }
        return entry;
    }

    private invalidate(entry: TopicEntry) {
        entry.revision += 1;
        clearTimeout(entry.timer);
        entry.timer = undefined;
        this.publish(entry, EMPTY_SNAPSHOT);
    }

    private needsRead(entry: TopicEntry) {
        return this.connected && (entry.forceRead || (entry.listeners.size > 0 &&
            (!CACHED_TOPICS.has(entry.topic) || !entry.snapshot.hasValue)));
    }

    private kick(entry: TopicEntry) {
        if (entry.running || entry.timer !== undefined || !this.needsRead(entry)) return;
        entry.running = true;
        const revision = entry.revision;
        void (async () => {
            let retryMs = entry.topic === "pyroHardwareArmed" || entry.topic.startsWith("pyroContinuity:")
                ? HARDWARE_POLL_MS : 0;
            try {
                const pollers = this.getPollers();
                const value = entry.topic.startsWith("pyroContinuity:")
                    ? await pollers.pyroContinuity(Number(entry.topic.split(":")[1]))
                    : await pollers[entry.topic as Exclude<keyof RocketStatusTopics, "pyroContinuity">]();
                if (entry.revision !== revision) return;
                entry.forceRead = false;
                this.publish(entry, { value, error: null, hasValue: true, lastUpdatedAt: Date.now() });
            } catch (error) {
                if (entry.revision !== revision) return;
                retryMs = ERROR_RETRY_MS;
                this.publish(entry, { ...entry.snapshot,
                    error: error instanceof Error ? error.message : String(error) });
            } finally {
                entry.running = false;
                if (this.needsRead(entry)) {
                    entry.timer = setTimeout(() => {
                        entry.timer = undefined;
                        this.kick(entry);
                    }, entry.revision === revision ? retryMs : 0);
                }
            }
        })();
    }

    private publish(entry: TopicEntry, snapshot: RocketStatusValue<unknown>) {
        entry.snapshot = snapshot;
        for (const listener of entry.listeners) listener();
    }
}