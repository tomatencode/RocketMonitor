import { useMemo, useState } from "react";
import {
    filterBackground,
    filterBorder,
    mutedBorder,
    radius,
} from "../../../shared/styles";
import { Button } from "../../../shared/components/primitives/Button";
import { Card } from "../../../shared/components/primitives/Card";
import { ScrollView } from "../../../shared/components/primitives/ScrollView";

export type PacketLogEntry = { direction: "send" | "receive"; ts: number };

type FormattedEntry = { label: string; detail: string; isText?: boolean };

interface PacketLogProps<T extends PacketLogEntry> {
    title: string;
    log: T[];
    formatEntry: (entry: T) => FormattedEntry;
}

export default function PacketLog<T extends PacketLogEntry>({ title, log, formatEntry }: PacketLogProps<T>) {
    const [clearedAt, setClearedAt] = useState(0);
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

    const visibleLog = useMemo(() => log.filter(entry => entry.ts > clearedAt), [log, clearedAt]);
    const logTypes = useMemo(() => [...new Set(visibleLog.map(formatEntry).map(entry => entry.label))], [visibleLog, formatEntry]);
    const filteredLog = useMemo(
        () => visibleLog.filter(entry => !hiddenTypes.has(formatEntry(entry).label)),
        [visibleLog, hiddenTypes, formatEntry]
    );

    function toggleType(type: string) {
        setHiddenTypes(previous => {
            const next = new Set(previous);
            if (next.has(type)) next.delete(type); else next.add(type);
            return next;
        });
    }

    return (
        <Card className="flex flex-1 flex-col min-h-0 gap-2 p-3">
            <div className="flex items-center justify-between shrink-0">
                <span className="text-xs text-zinc-600 uppercase tracking-widest">{title}</span>
                <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setClearedAt(Date.now())}>Clear</Button>
            </div>

            {logTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 shrink-0">
                    {logTypes.map(type => {
                        const hidden = hiddenTypes.has(type);
                        return (
                            <button
                                key={type}
                                onClick={() => toggleType(type)}
                                className={`px-2 py-0.5 text-xs ${radius} border font-mono transition-colors ${
                                    hidden
                                        ? `${mutedBorder} text-zinc-600 line-through`
                                        : `${filterBackground} ${filterBorder} text-zinc-300`
                                }`}
                            >
                                {type}
                            </button>
                        );
                    })}
                </div>
            )}

            <Card variant="inner" className="flex-1 min-h-0 overflow-hidden">
                <ScrollView stickToBottom blurEdges className="p-3 flex flex-col gap-1">
                    {filteredLog.length === 0 && (
                        <span className="text-zinc-600 text-xs">
                            {visibleLog.length === 0 ? "No packets yet." : "No packets match the filter."}
                        </span>
                    )}
                    {filteredLog.map((entry, index) => {
                        const { label, detail, isText } = formatEntry(entry);
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
            </Card>
        </Card>
    );
}