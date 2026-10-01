export type StatusDotTone = "neutral" | "ok" | "warn" | "danger" | "info";
export type StatusDotSize = "xs" | "sm";

interface StatusDotProps {
    /** Visual tone of the dot. Defaults to "neutral" (unknown/idle). */
    tone?: StatusDotTone;
    /** Render the ping halo (for active/alert states). */
    pulse?: boolean;
    /** Dot diameter. Defaults to "sm" (8px). */
    size?: StatusDotSize;
    className?: string;
}

const toneStyles: Record<StatusDotTone, string> = {
    neutral: "bg-zinc-600",
    ok: "bg-emerald-400",
    warn: "bg-amber-400",
    danger: "bg-red-400",
    info: "bg-sky-400",
};

const sizeStyles: Record<StatusDotSize, string> = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
};

/**
 * Small status dot with an optional ping halo for active/alert states.
 * Tone vocabulary is shared app-wide so "ok" always means the same green, etc.
 */
export function StatusDot({ tone = "neutral", pulse = false, size = "sm", className = "" }: StatusDotProps) {
    const dot = sizeStyles[size];
    if (!pulse) {
        return <span className={`inline-block rounded-full ${dot} ${toneStyles[tone]} ${className}`} />;
    }
    return (
        <span className={`relative flex ${dot} ${className}`}>
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${toneStyles[tone]}`} />
            <span className={`relative inline-flex rounded-full ${dot} ${toneStyles[tone]}`} />
        </span>
    );
}
