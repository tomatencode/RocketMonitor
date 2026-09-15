import { useMemo, useState } from "react";
import {
    filterBackground,
    filterBorder,
    mutedBorder,
    radius,
} from "../../../shared/styles";
import { Button } from "../../../shared/components/primitives/Button";
import { Card } from "../../../shared/components/primitives/Card";
import { AccentRow } from "../../../shared/components/primitives/AccentRow";
import { ScrollView } from "../../../shared/components/primitives/ScrollView";

type DataDirection = "send" | "receive";

// One entry per wire frame; a frame can carry several messages
export type PacketLogEntry<M extends { seqId: number }> = {
    direction: DataDirection;
    ts: number;
    frameId: number;
    messages: M[];
};

export type FormattedEntry = {
    label: string;
    detail: string;
    isText?: boolean;
    status?: { text: string; className: string };
};

interface PacketLogProps<M extends { seqId: number }> {
    title: string;
    log: PacketLogEntry<M>[];
    formatMessage: (message: M, direction: DataDirection) => FormattedEntry;
}

// Rotates by seqId so a request and its response (same seqId) get the same color
const SEQ_COLORS = [
    "bg-red-500/10 border-red-500/50",
    "bg-orange-500/10 border-orange-500/50",
    "bg-amber-500/10 border-amber-500/50",
    "bg-lime-500/10 border-lime-500/50",
    "bg-emerald-500/10 border-emerald-500/50",
    "bg-teal-500/10 border-teal-500/50",
    "bg-sky-500/10 border-sky-500/50",
    "bg-indigo-500/10 border-indigo-500/50",
    "bg-purple-500/10 border-purple-500/50",
    "bg-pink-500/10 border-pink-500/50",
];

function seqColor(seqId: number): string {
    return SEQ_COLORS[seqId % SEQ_COLORS.length];
}

const CONNECTOR_COLOR = "border-zinc-600";
const NO_RESPONSE_CONNECTOR_COLOR = "border-red-500";

export default function PacketLog<M extends { seqId: number }>({ title, log, formatMessage }: PacketLogProps<M>) {
    const [clearedAt, setClearedAt] = useState(0);
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

    const visibleLog = useMemo(() => log.filter(entry => entry.ts > clearedAt), [log, clearedAt]);

    const logTypes = useMemo(() => {
        const labels = new Set<string>();
        for (const entry of visibleLog) {
            for (const message of entry.messages) labels.add(formatMessage(message, entry.direction).label);
        }
        return [...labels];
    }, [visibleLog, formatMessage]);

    // Entries with every message hidden by the type filter are dropped entirely
    const filteredLog = useMemo(() => {
        return visibleLog
            .map(entry => ({
                ...entry,
                messages: entry.messages.filter(message => !hiddenTypes.has(formatMessage(message, entry.direction).label)),
            }))
            .filter(entry => entry.messages.length > 0);
    }, [visibleLog, hiddenTypes, formatMessage]);

    // Every sent frame gets a matching response frame; join them under one line, or flag red if the response hasn't arrived
    const displayBlocks = useMemo(() => {
        const claimedResponses = new Set<number>();
        const responseFor = new Map<number, (typeof filteredLog)[number]>();

        for (let i = 0; i < filteredLog.length; i++) {
            const entry = filteredLog[i];
            if (entry.direction !== "send") continue;

            const seqIds = new Set(entry.messages.map(m => m.seqId));
            if (seqIds.size === 0) continue;

            const response = filteredLog.slice(i + 1).find(e =>
                e.direction === "receive" &&
                !claimedResponses.has(e.frameId) &&
                e.messages.some(m => seqIds.has(m.seqId))
            );

            if (response) {
                claimedResponses.add(response.frameId);
                responseFor.set(entry.frameId, response);
            }
        }

        const blocks: { key: number; frames: (typeof filteredLog)[number][]; color: string }[] = [];
        for (const entry of filteredLog) {
            if (claimedResponses.has(entry.frameId)) continue; // rendered as part of its request's block below
            if (entry.direction === "send") {
                const response = responseFor.get(entry.frameId);
                blocks.push({
                    key: entry.frameId,
                    frames: response ? [entry, response] : [entry],
                    color: response ? CONNECTOR_COLOR : NO_RESPONSE_CONNECTOR_COLOR,
                });
            } else {
                blocks.push({ key: entry.frameId, frames: [entry], color: "border-transparent" });
            }
        }
        return blocks;
    }, [filteredLog]);

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
                <ScrollView stickToBottom className="p-3 flex flex-col gap-4">
                    {filteredLog.length === 0 && (
                        <span className="text-zinc-600 text-xs">
                            {visibleLog.length === 0 ? "No packets yet." : "No packets match the filter."}
                        </span>
                    )}
                    {displayBlocks.map(block => (
                        <div key={block.key} className={`flex flex-col gap-2 border-l-2 pl-2 ${block.color}`}>
                            {block.frames.map(entry => {
                                const isTx = entry.direction === "send";
                                return (
                                    <div key={entry.frameId} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-xs font-mono">
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
                                            <span className="text-zinc-700 text-[10px] uppercase tracking-wide">{isTx ? "sent frame" : "received frame"}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 pl-7">
                                            {entry.messages.map((message, index) => {
                                                const { label, detail, isText, status } = formatMessage(message, entry.direction);
                                                return (
                                                    <AccentRow
                                                        key={index}
                                                        accent={seqColor(message.seqId)}
                                                        className="flex gap-2 text-xs leading-relaxed font-mono px-1.5 py-0.5"
                                                    >
                                                        <span className="shrink-0 w-8 text-zinc-500">#{message.seqId}</span>
                                                        <span className="shrink-0 font-semibold min-w-[9rem] text-zinc-300">
                                                            {label}
                                                        </span>
                                                        {status && (
                                                            <span className={`shrink-0 self-start px-1.5 text-[10px] font-semibold rounded border ${status.className}`}>
                                                                {status.text}
                                                            </span>
                                                        )}
                                                        {detail && <span className={`break-all ${isText ? "text-yellow-200" : "text-zinc-400"}`}>{detail}</span>}
                                                    </AccentRow>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </ScrollView>
            </Card>
        </Card>
    );
}