import { useEffect, useMemo, useRef, useState } from "react";
import {
    filterBackground,
    filterBorder,
    mutedBorder,
    radius,
} from "../../../shared/styles";
import { Button } from "../../../shared/components/primitives/Button";
import { Card } from "../../../shared/components/primitives/Card";

export type PacketLogEntry = { direction: "send" | "receive"; ts: number; frameId: number };

export type FormattedEntry = {
    label: string;
    detail: string;
    isText?: boolean;
    seqId?: number;
    status?: { text: string; className: string };
};

interface PacketLogProps<T extends PacketLogEntry> {
    title: string;
    log: T[];
    formatEntry: (entry: T) => FormattedEntry;
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

function seqColor(seqId?: number): string {
    if (seqId === undefined) return "border-transparent";
    return SEQ_COLORS[seqId % SEQ_COLORS.length];
}

const CONNECTOR_COLOR = "border-zinc-600";
const NO_RESPONSE_CONNECTOR_COLOR = "border-red-500";

export default function PacketLog<T extends PacketLogEntry>({ title, log, formatEntry }: PacketLogProps<T>) {
    const [clearedAt, setClearedAt] = useState(0);
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
    const logEndRef = useRef<HTMLDivElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);

    const visibleLog = useMemo(() => log.filter(entry => entry.ts > clearedAt), [log, clearedAt]);
    const logTypes = useMemo(() => [...new Set(visibleLog.map(formatEntry).map(entry => entry.label))], [visibleLog, formatEntry]);
    const filteredLog = useMemo(
        () => visibleLog.filter(entry => !hiddenTypes.has(formatEntry(entry).label)),
        [visibleLog, hiddenTypes, formatEntry]
    );

    // Consecutive entries sharing a frameId are grouped so the timestamp/direction is shown once per frame
    const frameGroups = useMemo(() => {
        const groups: { frameId: number; ts: number; direction: T["direction"]; entries: T[] }[] = [];
        for (const entry of filteredLog) {
            const last = groups[groups.length - 1];
            if (last && last.frameId === entry.frameId) {
                last.entries.push(entry);
            } else {
                groups.push({ frameId: entry.frameId, ts: entry.ts, direction: entry.direction, entries: [entry] });
            }
        }
        return groups;
    }, [filteredLog]);

    // Every sent frame gets a matching response frame; join them under one line, or flag red if the response hasn't arrived
    type FrameGroup = (typeof frameGroups)[number];
    const displayBlocks = useMemo(() => {
        const claimedResponses = new Set<number>();
        const responseFor = new Map<number, FrameGroup>();

        for (let i = 0; i < frameGroups.length; i++) {
            const group = frameGroups[i];
            if (group.direction !== "send") continue;

            const seqIds = new Set(group.entries.map(e => formatEntry(e).seqId).filter((s): s is number => s !== undefined));
            if (seqIds.size === 0) continue;

            const response = frameGroups.slice(i + 1).find(g =>
                g.direction === "receive" &&
                !claimedResponses.has(g.frameId) &&
                g.entries.some(e => {
                    const seqId = formatEntry(e).seqId;
                    return seqId !== undefined && seqIds.has(seqId);
                })
            );

            if (response) {
                claimedResponses.add(response.frameId);
                responseFor.set(group.frameId, response);
            }
        }

        const blocks: { key: number; frames: FrameGroup[]; color: string }[] = [];
        for (const group of frameGroups) {
            if (claimedResponses.has(group.frameId)) continue; // rendered as part of its request's block below
            if (group.direction === "send") {
                const response = responseFor.get(group.frameId);
                blocks.push({
                    key: group.frameId,
                    frames: response ? [group, response] : [group],
                    color: response ? CONNECTOR_COLOR : NO_RESPONSE_CONNECTOR_COLOR,
                });
            } else {
                blocks.push({ key: group.frameId, frames: [group], color: "border-transparent" });
            }
        }
        return blocks;
    }, [frameGroups, formatEntry]);

    useEffect(() => {
        if (isAtBottomRef.current) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [filteredLog.length]);

    function handleLogScroll() {
        const element = logContainerRef.current;
        if (element) isAtBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
    }

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

            <Card variant="inner" ref={logContainerRef} onScroll={handleLogScroll} className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
                {filteredLog.length === 0 && (
                    <span className="text-zinc-600 text-xs">
                        {visibleLog.length === 0 ? "No packets yet." : "No packets match the filter."}
                    </span>
                )}
                {displayBlocks.map(block => (
                    <div key={block.key} className={`flex flex-col gap-2 border-l-2 pl-2 ${block.color}`}>
                        {block.frames.map(group => {
                            const isTx = group.direction === "send";
                            return (
                                <div key={group.frameId} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                        <span className="text-zinc-600 shrink-0 w-20">
                                            {new Date(group.ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                            <span className="text-zinc-700">.{String(group.ts % 1000).padStart(3, "0")}</span>
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
                                        {group.entries.map((entry, index) => {
                                            const { label, detail, isText, seqId, status } = formatEntry(entry);
                                            return (
                                                <div
                                                    key={index}
                                                    className={`flex gap-2 text-xs leading-relaxed font-mono px-1.5 py-0.5 ${radius} border-l-2 ${seqColor(seqId)}`}
                                                >
                                                    {seqId !== undefined && (
                                                        <span className="shrink-0 w-8 text-zinc-500">#{seqId}</span>
                                                    )}
                                                    <span className={`shrink-0 font-semibold min-w-[9rem] text-zinc-300`}>
                                                        {label}
                                                    </span>
                                                    {status && (
                                                        <span className={`shrink-0 self-start px-1.5 text-[10px] font-semibold rounded border ${status.className}`}>
                                                            {status.text}
                                                        </span>
                                                    )}
                                                    {detail && <span className={`break-all ${isText ? "text-yellow-200" : "text-zinc-400"}`}>{detail}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
                <div ref={logEndRef} />
            </Card>
        </Card>
    );
}