import type { ComponentPropsWithRef } from "react";
import { inputBackground, radius } from "../../styles";

type ProgressBarTone = "neutral" | "info" | "ok" | "warn" | "danger";

export interface ProgressBarProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
    /** Omit the value while the amount of work is unknown. */
    value?: number;
    /** Total amount of work. Defaults to 100. */
    max?: number;
    tone?: ProgressBarTone;
}

const toneStyles: Record<ProgressBarTone, string> = {
    neutral: "bg-zinc-500/80",
    info: "bg-sky-400/80",
    ok: "bg-emerald-400/80",
    warn: "bg-amber-400/80",
    danger: "bg-red-400/80",
};

/** Compact, accessible progress indicator styled like the app's other primitives. */
export function ProgressBar({ value, max = 100, tone = "info", className = "", ...props }: ProgressBarProps) {
    const total = Number.isFinite(max) && max > 0 ? max : 100;
    const determinate = value !== undefined && Number.isFinite(value);
    const current = determinate ? Math.min(total, Math.max(0, value)) : undefined;
    const percentage = current === undefined ? undefined : current / total * 100;

    return (
        <div
            {...props}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={current}
            className={`w-full h-2 overflow-hidden border border-zinc-700/60 ${inputBackground} ${radius} ${className}`}
        >
            <div
                aria-hidden="true"
                className={`h-full ${radius} ${toneStyles[tone]} ${determinate
                    ? "transition-[width] duration-200 ease-out motion-reduce:transition-none"
                    : "w-full animate-pulse motion-reduce:animate-none"}`}
                style={percentage === undefined ? undefined : { width: `${percentage}%` }}
            />
        </div>
    );
}