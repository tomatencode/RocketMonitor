import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

// A message paired with its formatted output, computed once and reused across the filter/render passes below
type FormattedMessage<M> = { message: M; formatted: FormattedEntry };

export default function PacketLog<M extends { seqId: number }>({ log, formatMessage }: PacketLogProps<M>) {

    // formatMessage runs once per message here instead of being re-invoked in every later pass
    const formattedLog = useMemo(() => {
        return log.map(entry => ({
            ...entry,
            messages: entry.messages.map((message): FormattedMessage<M> => ({ message, formatted: formatMessage(message, entry.direction) })),
        }));
    }, [log, formatMessage]);

    const displayBlocks = useMemo(() => {
        const blocks: { key: number; frames: (typeof formattedLog)[number][]; color: string }[] = [];
        for (let index = 0; index < formattedLog.length; index++) {
            const entry = formattedLog[index];
            const response = formattedLog[index + 1];

            if (entry.direction === "send" && response?.direction === "receive") {
                blocks.push({ key: entry.frameId, frames: [entry, response], color: CONNECTOR_COLOR });
                index++;
            } else if (entry.direction === "send") {
                blocks.push({ key: entry.frameId, frames: [entry], color: NO_RESPONSE_CONNECTOR_COLOR });
            } else {
                blocks.push({ key: entry.frameId, frames: [entry], color: "border-transparent" });
            }
        }
        return blocks;
    }, [formattedLog]);

    const scrollElementRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: displayBlocks.length,
        getScrollElement: () => scrollElementRef.current,
        getItemKey: index => displayBlocks[index].key,
        estimateSize: () => 100,
        overscan: 5,
    });

    return (
        <ScrollView
            stickToBottom
            blurTop
            initialScrollPosition="bottom"
            scrollElementRef={scrollElementRef}
            className="p-3"
        >
            {formattedLog.length === 0 && (
                <span className="text-zinc-600 text-xs">
                    {log.length === 0 ? "No packets yet." : "No packets match the filter."}
                </span>
            )}
            {displayBlocks.length > 0 && (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                    {virtualizer.getVirtualItems().map(virtualRow => {
                        const block = displayBlocks[virtualRow.index];
                        return (
                            <div
                                key={block.key}
                                ref={virtualizer.measureElement}
                                data-index={virtualRow.index}
                                className="absolute left-0 top-0 w-full pb-4"
                                style={{ transform: `translateY(${virtualRow.start}px)` }}
                            >
                                <div className={`flex flex-col gap-2 border-l-2 pl-2 ${block.color}`}>
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
                                                    {entry.messages.map(({ message, formatted: { label, detail, isText, status } }, index) => (
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
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </ScrollView>
    );
}