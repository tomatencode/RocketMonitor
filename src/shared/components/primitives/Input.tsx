import type { ComponentPropsWithRef } from "react";
import { inputBackground, radius } from "../../styles";


interface InputProps extends ComponentPropsWithRef<"input"> {
    
}


export function Input({ className = "",  ...props }: InputProps) {
	return (
		<input
			className={`${inputBackground} border border-zinc-600 focus:border-zinc-500 ${radius} px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none disabled:opacity-40 ${className}`}
			{...props}
		/>
	);
}