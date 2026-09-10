import type { ComponentPropsWithRef } from "react";
import { inputBackground, inputBorder, radius } from "../../styles";


interface InputProps extends ComponentPropsWithRef<"input"> {
    
}


export function Input({ className = "",  ...props }: InputProps) {
	return (
		<input
			className={`${inputBackground} border ${inputBorder} ${radius} px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none disabled:opacity-40 ${className}`}
			{...props}
		/>
	);
}