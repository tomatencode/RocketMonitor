import type { ComponentPropsWithRef, ReactNode } from "react";
import { radius } from "../../styles";

type CardVariant = "inner" | "outer" | "ghost" | "empty" | "success" | "info" | "warning" | "error";

interface CardProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
    outer: `bg-zinc-950/55 border border-zinc-600/50`,
    inner: "bg-zinc-900/40 border-zinc-700/50",
    ghost: "bg-zinc-900/30 border-zinc-700/50",
    empty: "bg-zinc-900/30 border-dashed border-zinc-700/50",
    success: "bg-emerald-950/20 border-emerald-800/40",
    info: "bg-sky-950/20 border-sky-800/40",
    warning: "bg-amber-950/20 border-amber-800/40",
    error: "bg-red-950/30 border-red-800/50",
};

/** Shared surface colors; callers supply layout, spacing, and text styling. */
export function Card({ children, variant = "outer", className = "", ...props }: CardProps) {
    return (
        <div className={`border ${radius} ${variantStyles[variant]} transition-colors backdrop-blur-sm pointer-events-auto ${className}`} {...props}>
            {children}
        </div>
    );
}
