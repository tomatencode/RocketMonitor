import type { ReactNode } from "react";

type ChannelRowTone = "neutral" | "ok";

interface ChannelRowProps {
    index: number;
    label: string;
    status: ReactNode;
    controls: ReactNode;
    tone?: ChannelRowTone;
    dimmed?: boolean;
    className?: string;
}

const toneStyles: Record<ChannelRowTone, string> = {
    neutral: "border-zinc-700/50 bg-zinc-900/40",
    ok: "border-zinc-700/50 bg-zinc-800/40",
};

/**
 * Standard numbered list row: index badge + label/status on the left,
 * caller-supplied controls (inputs, buttons) on the right.
 */
export function ChannelRow({ index, label, status, controls, tone = "neutral", dimmed = false, className = "" }: ChannelRowProps) {
    return (
        <div
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${toneStyles[tone]} ${dimmed ? "opacity-80" : ""} ${className}`}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                        tone === "ok"
                            ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
                            : "border-zinc-700 bg-zinc-800/60 text-zinc-500"
                    }`}
                >
                    {index + 1}
                </span>
                <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-xs font-semibold text-zinc-200">{label}</span>
                    {status}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">{controls}</div>
        </div>
    );
}
