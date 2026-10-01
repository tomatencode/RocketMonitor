import type { ReactNode } from "react";

type StatusTileTone = "neutral" | "ok" | "warn" | "danger" | "info";

interface StatusTileProps {
    label: string;
    value: string;
    icon: ReactNode;
    tone?: StatusTileTone;
    className?: string;
    title?: string;
}

const tileStyles: Record<StatusTileTone, string> = {
    neutral: "border-zinc-700/50 bg-zinc-800/40",
    ok: "border-emerald-800/50 bg-emerald-950/30",
    warn: "border-amber-700/60 bg-amber-950/40",
    danger: "border-red-800/60 bg-red-950/40",
    info: "border-sky-800/60 bg-sky-950/40",
};

const valueStyles: Record<StatusTileTone, string> = {
    neutral: "text-zinc-500",
    ok: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-red-300",
    info: "text-sky-300",
};

/**
 * Small two-line status tile: uppercase label over a bold value, led by an icon/dot.
 * Used for side-by-side interlock/sensor states inside a panel.
 */
export function StatusTile({ label, value, icon, tone = "neutral", className = "", title }: StatusTileProps) {
    return (
        <div
            title={title}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${tileStyles[tone]} ${className}`}
        >
            {icon}
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
                <span className={`text-xs font-bold tracking-wide ${valueStyles[tone]}`}>{value}</span>
            </div>
        </div>
    );
}
