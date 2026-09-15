import { useMemo } from "react";
import { ScrollView } from "../../../shared/components/primitives/ScrollView";

export type PacketLogEntry = { direction: "send" | "receive"; ts: number };

type FormattedEntry = { label: string; detail: string; isText?: boolean };

interface PacketLogProps<T extends PacketLogEntry> {
    log: T[];
    formatEntry: (entry: T) => FormattedEntry;
}

export default function PacketLog<T extends PacketLogEntry>({ log, formatEntry }: PacketLogProps<T>) {

    // formatEntry runs once per entry here instead of being re-invoked in every later pass
    const formattedLog = useMemo(
        () => log.map(entry => ({ entry, formatted: formatEntry(entry) })),
        [log, formatEntry]
    );

    return (
        <ScrollView
            stickToBottom
            blurTop
            initialScrollPosition="bottom"
            className="p-3 flex flex-col gap-1"
        >
            {formattedLog.length === 0 && (
                <span className="text-zinc-600 text-xs">
                    {log.length === 0 ? "No packets yet." : "No packets match the filter."}
                </span>
            )}
            {formattedLog.map(({ entry, formatted: { label, detail, isText } }, index) => {
                const isTx = entry.direction === "send";
                return (
                    <div key={index} className="flex gap-2 text-xs leading-relaxed font-mono">
                        <span className="text-zinc-600 shrink-0 w-20">
                            {new Date(entry.ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            <span className="text-zinc-700">.{String(entry.ts % 1000).padStart(3, "0")}</span>
                        </span>
                        <span className={`shrink-0 w-5 flex items-center justify-center ${isTx ? "text-zinc-400" : "text-green-400"}`}>
                            {isTx ? (
                                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M8 13V3M3 8l5-5 5 5" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M8 3v10M3 8l5 5 5-5" />
                                </svg>
                            )}
                        </span>
                        <span className={`shrink-0 font-semibold min-w-[11rem] ${isTx ? "text-zinc-300" : "text-green-300"}`}>
                            {label}
                        </span>
                        {detail && <span className={`break-all ${isText ? "text-yellow-200" : "text-zinc-400"}`}>{detail}</span>}
                    </div>
                );
            })}
        </ScrollView>
    );
}