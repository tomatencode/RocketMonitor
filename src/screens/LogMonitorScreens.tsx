import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { JobStatus, Message, MessageType } from "../features/RadioLink/Protocol";
import RadioPacketLog, { PacketLogEntry as RadioLogEntry } from "../features/RadioLink/components/PacketLog";
import { Packet, PacketType } from "../features/RocketLink/Protocol";
import RocketPacketLog from "../features/RocketLink/components/PacketLog";
import { LogEntry as RocketLogEntry } from "../features/RocketLink/usePacketTransport";
import { appBackground } from "../shared/styles";

const MAX_LOG_ENTRIES = 1000;

type SerializedRocketLogEntry = { direction: "send" | "receive"; ts: number } & (
    | { packet: { type: PacketType; payload: number[] }; data?: never }
    | { data: number[]; packet?: never }
);

type SerializedRadioLogEntry = Omit<RadioLogEntry<Message>, "messages"> & {
    messages: Array<Omit<Message, "payload"> & { payload: number[] }>;
};

function append<T>(setLog: React.Dispatch<React.SetStateAction<T[]>>, entry: T) {
    setLog(previous => [...previous, entry].slice(-MAX_LOG_ENTRIES));
}

function toHex(bytes: ArrayLike<number>) {
    return Array.from(bytes).map(byte => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function statusBadge(status: JobStatus): { text: string; className: string } {
    switch (status) {
        case JobStatus.SUCCESS: return { text: "OK", className: "text-green-300 border-green-700/50" };
        case JobStatus.FAILURE: return { text: "FAIL", className: "text-red-300 border-red-700/50" };
        default: return { text: "BUSY", className: "text-yellow-300 border-yellow-700/50" };
    }
}

function formatRadioMessage(message: Message, direction: "send" | "receive") {
    return {
        label: MessageType[message.type] ?? `0x${message.type.toString(16).toUpperCase()}`,
        detail: toHex(message.payload),
        status: direction === "receive" ? statusBadge(message.status) : undefined,
    };
}

function formatRocketEntry(entry: RocketLogEntry) {
    if (entry.packet) {
        const isText = entry.packet.type === PacketType.AT_CMD || entry.packet.type === PacketType.AT_RESP;
        return {
            label: PacketType[entry.packet.type] ?? `0x${entry.packet.type.toString(16).toUpperCase()}`,
            detail: isText ? new TextDecoder().decode(entry.packet.payload) : toHex(entry.packet.payload),
            isText,
        };
    }
    return { label: "RAW", detail: toHex(entry.data ?? []), isText: false };
}

function deserializeRocketEntry(entry: SerializedRocketLogEntry): RocketLogEntry {
    if (entry.packet) {
        return { direction: entry.direction, ts: entry.ts, packet: { ...entry.packet, payload: new Uint8Array(entry.packet.payload) } as Packet };
    }
    return { direction: entry.direction, ts: entry.ts, data: entry.data };
}

function deserializeRadioEntry(entry: SerializedRadioLogEntry): RadioLogEntry<Message> {
    return {
        ...entry,
        messages: entry.messages.map(message => ({ ...message, payload: new Uint8Array(message.payload) })),
    };
}

export function RocketLogMonitor() {
    const [log, setLog] = useState<RocketLogEntry[]>([]);

    useEffect(() => {
        let active = true;
        let cleanup: (() => void) | undefined;

        async function initialize() {
            const history = await invoke<SerializedRocketLogEntry[]>("get_rocket_log_history");
            if (active) setLog(history.map(deserializeRocketEntry));

            cleanup = await listen<SerializedRocketLogEntry>("rocket-log-entry", event => {
                append<RocketLogEntry>(setLog, deserializeRocketEntry(event.payload));
            });
            if (!active) cleanup();
        }

        void initialize();
        return () => {
            active = false;
            cleanup?.();
        };
    }, []);

    return <LogWindow><RocketPacketLog title="Rocket Link Packet Log" log={log} formatEntry={formatRocketEntry} /></LogWindow>;
}

export function RadioLogMonitor() {
    const [log, setLog] = useState<RadioLogEntry<Message>[]>([]);

    useEffect(() => {
        let active = true;
        let cleanup: (() => void) | undefined;

        async function initialize() {
            const history = await invoke<SerializedRadioLogEntry[]>("get_radio_log_history");
            if (active) setLog(history.map(deserializeRadioEntry));

            cleanup = await listen<SerializedRadioLogEntry>("radio-log-entry", event => {
                append(setLog, deserializeRadioEntry(event.payload));
            });
            if (!active) cleanup();
        }

        void initialize();
        return () => {
            active = false;
            cleanup?.();
        };
    }, []);

    return <LogWindow><RadioPacketLog title="Radio Packet Log" log={log} formatMessage={formatRadioMessage} /></LogWindow>;
}

function LogWindow({ children }: { children: React.ReactNode }) {
    return <div className={`flex h-screen overflow-hidden p-3 ${appBackground} text-zinc-200 font-mono text-sm`}>{children}</div>;
}