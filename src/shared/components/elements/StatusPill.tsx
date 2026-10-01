import type { ReactNode } from "react";
import { StatusDot } from "./StatusDot";

type StatusPillTone = "neutral" | "ok" | "warn" | "danger" | "info";

interface StatusPillProps {
    children: ReactNode;
    tone?: StatusPillTone;
    pulse?: boolean;
    className?: string;
    title?: string;
}

const toneStyles: Record<StatusPillTone, string> = {
    neutral: "border-zinc-700/60 bg-zinc-800/50 text-zinc-500",
    ok: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
    warn: "border-amber-700/60 bg-amber-950/40 text-amber-300",
    danger: "border-red-700/60 bg-red-950/50 text-red-300",
    info: "border-sky-700/60 bg-sky-950/40 text-sky-300",
};

/**
 * Uppercase pill badge with a leading status dot, e.g. `Armed` / `Safe` / `Offline`.
 * Same tone vocabulary as StatusDot so panels read consistently.
 */
export function StatusPill({ children, tone = "neutral", pulse = false, className = "", title }: StatusPillProps) {
    return (
        <span
            title={title}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneStyles[tone]} ${className}`}
        >
            <StatusDot tone={tone} size="xs" pulse={pulse} />
            {children}
        </span>
    );
}
