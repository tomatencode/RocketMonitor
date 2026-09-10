import type { ComponentPropsWithRef, ReactNode } from "react";
import { appBackground, radius } from "../../styles";

type CardVariant = "inner" | "outer" | "ghost" | "warning" | "error";

interface CardProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
    outer: `bg-zinc-800/20 border border-zinc-700/50 ${radius}`,
    inner: `bg-zinc-800/70 ${radius}`,
    ghost: `${appBackground} border-zinc-700/50 ${radius}`,
    warning: `bg-yellow-800/20 border border-yellow-700/50 ${radius}`,
    error: `bg-red-800/20 border border-red-700/50 ${radius}`,
};

export function Card({ children, variant = "outer", className = "", ...props }: CardProps) {
    return (
        <div className={`${variantStyles[variant]} ${className}`} {...props}>
            {children}
        </div>
    );
}
