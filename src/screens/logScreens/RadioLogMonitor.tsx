import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { LogWindow } from "../../features/Logs/components/LogWindow";
import { JobStatus, Message, MessageType } from "../../features/RadioLink/Protocol";
import RadioPacketLog, { PacketLogEntry as RadioLogEntry } from "../../features/Logs/components/RadioLog";
import { getFilterMessageTypes, RadioLogFilter } from "../../features/Logs/components/RadioLogFilter";

const MAX_LOG_ENTRIES = 1000;

type SerializedRadioLogEntry = Omit<RadioLogEntry<Message>, "messages"> & {
    messages: Array<Omit<Message, "payload"> & { payload: number[] }>;
};

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

function deserializeRadioEntry(entry: SerializedRadioLogEntry): RadioLogEntry<Message> {
    return {
        ...entry,
        messages: entry.messages.map(message => ({ ...message, payload: new Uint8Array(message.payload) })),
    };
}

export function RadioLogMonitor() {
    const [log, setLog] = useState<RadioLogEntry<Message>[]>([]);
    const [showFilters, setShowFilters] = useState(true);

    useEffect(() => {
        let active = true;
        let cleanup: (() => void) | undefined;

        async function initialize() {
            const history = await invoke<SerializedRadioLogEntry[]>("get_radio_log_history");
            if (active) setLog(history.map(deserializeRadioEntry));
            cleanup = await listen<SerializedRadioLogEntry>("radio-log-entry", event => {
                setLog(previous => [...previous, deserializeRadioEntry(event.payload)].slice(-MAX_LOG_ENTRIES));
            });
            if (!active) cleanup();
        }

        void initialize();
        return () => { active = false; cleanup?.(); };
    }, []);

    const [excludedTypes, setExcludedTypes] = useState<Partial<Record<MessageType, boolean>>>({});

    const filterMessageTypes = useMemo(
        () => getFilterMessageTypes(log.flatMap(entry => entry.messages.map(message => message.type))),
        [log]
    );

    const filteredLog = useMemo(() => {
        return log
            .map(entry => ({
                ...entry,
                messages: entry.messages.filter(message => !excludedTypes[message.type]),
            }))
            .filter(entry => entry.messages.length > 0);
    }, [log, excludedTypes]);

    function toggleExcludedType(messageType: MessageType) {
        setExcludedTypes(currentTypes => ({
            ...currentTypes,
            [messageType]: !currentTypes[messageType],
        }));
    }

    return (
        <LogWindow title="Radio Link Log" titleButtons={[
            { label: "Clear", onClick: () => setLog([]) },
            { label: showFilters ? "Hide Filters" : "Show Filters", onClick: () => setShowFilters(current => !current) },
        ]}>
            <RadioLogFilter messageTypes={filterMessageTypes} excludedTypes={excludedTypes} onToggle={toggleExcludedType} isOpen={showFilters} />
            <RadioPacketLog log={filteredLog} formatMessage={formatRadioMessage} />
        </LogWindow>
    );

}