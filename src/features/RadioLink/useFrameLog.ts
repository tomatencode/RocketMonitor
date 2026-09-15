import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { Message } from "./Protocol";

export type DataDirection = "send" | "receive";
export type LogEntry = {
    direction: DataDirection;
    ts: number;
    frameId: number;
    messages: Message[];
};

const MAX_LOG_ENTRIES = 1000;

export function useFrameLog() {
    const [log, setLog] = useState<LogEntry[]>([]);

    const addLogEntry = useCallback((entry: LogEntry) => {
        setLog((prev) => {
            const newLog = [...prev, entry];
            if (newLog.length > MAX_LOG_ENTRIES) newLog.shift();
            return newLog;
        });
        void invoke("broadcast_radio_log", {
            entry: {
                ...entry,
                messages: entry.messages.map((message) => ({
                    ...message,
                    payload: Array.from(message.payload),
                })),
            },
        });
    }, []);

    return { log, addLogEntry };
}
