import type { ButtonHTMLAttributes, ReactNode } from "react";
import { radius } from "../../styles";

type ButtonVariant = "neutral" | "primary" | "ghost" | "success" | "warning" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
	neutral: `bg-zinc-700/60 hover:bg-zinc-600/60 border border-zinc-600/60 hover:border-zinc-500 ${radius} font-semibold text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none`,
	primary: `bg-zinc-700/80 hover:bg-zinc-600/80 border border-zinc-600/60 hover:border-zinc-500 ${radius} font-semibold text-zinc-100 transition-colors shadow-sm shadow-zinc-950/30 disabled:opacity-40 disabled:pointer-events-none`,
	ghost: `bg-transparent hover:bg-zinc-800 border border-zinc-700 ${radius} font-medium text-zinc-400 transition-colors`,
	success: `bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 ${radius} font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30 disabled:opacity-40 disabled:pointer-events-none`,
	warning: `bg-yellow-700/80 hover:bg-yellow-600/80 border border-yellow-600/60 hover:border-yellow-500 ${radius} font-semibold text-yellow-100 transition-colors shadow-sm shadow-yellow-900/30 disabled:opacity-40 disabled:pointer-events-none`,
	danger: `bg-red-900/60 hover:bg-red-800/60 border border-red-800/60 hover:border-red-700 ${radius} font-semibold text-red-300 hover:text-red-200 transition-colors shadow-sm shadow-red-950/30 disabled:opacity-40 disabled:pointer-events-none`,
};

export function Button({ children, className = "", type = "button", variant = "neutral", ...props }: ButtonProps) {
	return (
		<button type={type} className={`${variantStyles[variant]} ${className}`} {...props}>
			{children}
		</button>
	);
}
