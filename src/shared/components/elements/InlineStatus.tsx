import type { ReactNode } from "react";
import { StatusDot, type StatusDotTone } from "./StatusDot";

type InlineStatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

interface InlineStatusProps {
    children: ReactNode;
    tone?: InlineStatusTone;
    pulse?: boolean;
    className?: string;
}

const toneStyles: Record<InlineStatusTone, string> = {
    neutral: "text-zinc-500",
    ok: "text-emerald-300",
    warn: "text-amber-300/90",
    danger: "text-red-300",
    info: "text-sky-300",
};

/**
 * Tiny uppercase status line with a leading dot, for use inside ChannelRows.
 * Same tone vocabulary as StatusDot/StatusPill/StatusTile.
 */
export function InlineStatus({ children, tone = "neutral", pulse = false, className = "" }: InlineStatusProps) {
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${toneStyles[tone]} ${className}`}>
            <StatusDot tone={tone as StatusDotTone} size="xs" pulse={pulse} />
            {children}
        </span>
    );
}
