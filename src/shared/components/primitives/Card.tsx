import type { ComponentPropsWithRef, ReactNode } from "react";
import { appBackground, radius } from "../../styles";

type CardVariant = "inner" | "outer" | "ghost" | "warning" | "error";

interface CardProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
    outer: `bg-zinc-950/55 border border-zinc-600/50 ${radius}`,
    inner: `bg-zinc-800/50 ${radius}`,
    ghost: `${appBackground} border border-zinc-700/50 ${radius}`,
    warning: `bg-yellow-800/20 border border-yellow-700/50 ${radius}`,
    error: `bg-red-800/20 border border-red-700/50 ${radius}`,
};

export function Card({ children, variant = "outer", className = "", ...props }: CardProps) {
    return (
        <div className={`${variantStyles[variant]} backdrop-blur-sm ${className}`} {...props}>
            {children}
        </div>
    );
}
