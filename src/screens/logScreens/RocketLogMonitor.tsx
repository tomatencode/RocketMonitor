import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { LogWindow } from "../../features/Logs/components/LogWindow";
import { Packet, PacketType } from "../../features/RocketLink/Protocol";
import RocketPacketLog from "../../features/Logs/components/RocketLinkLog";
import { LogEntry as RocketLogEntry } from "../../features/RocketLink/usePacketTransport";

const MAX_LOG_ENTRIES = 1000;

type SerializedRocketLogEntry = { direction: "send" | "receive"; ts: number } & (
    | { packet: { type: PacketType; payload: number[] }; data?: never }
    | { data: number[]; packet?: never }
);

function toHex(bytes: ArrayLike<number>) {
    return Array.from(bytes).map(byte => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
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

export function RocketLogMonitor() {
    const [log, setLog] = useState<RocketLogEntry[]>([]);

    useEffect(() => {
        let active = true;
        let cleanup: (() => void) | undefined;

        async function initialize() {
            const history = await invoke<SerializedRocketLogEntry[]>("get_rocket_log_history");
            if (active) setLog(history.map(deserializeRocketEntry));
            cleanup = await listen<SerializedRocketLogEntry>("rocket-log-entry", event => {
                setLog(previous => [...previous, deserializeRocketEntry(event.payload)].slice(-MAX_LOG_ENTRIES));
            });
            if (!active) cleanup();
        }

        void initialize();
        return () => { active = false; cleanup?.(); };
    }, []);

    return (
        <LogWindow title="Rocket Link Log" titleButtons={[{ label: "Clear", onClick: () => setLog([]) }]}>
            <RocketPacketLog log={log} formatEntry={formatRocketEntry} />
        </LogWindow>
    );
}