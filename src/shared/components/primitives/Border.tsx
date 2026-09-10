import type { HTMLAttributes } from "react";
import { dividerBorder } from "../../styles";

type BorderOrientation = "horizontal" | "vertical";

interface BorderProps extends HTMLAttributes<HTMLDivElement> {
	orientation?: BorderOrientation;
}

export function Border({ className = "", orientation = "horizontal", ...props }: BorderProps) {
	const isHorizontal = orientation === "horizontal";

	return (
		<div
			aria-orientation={orientation}
			className={`${isHorizontal ? `border-t ${dividerBorder} w-full` : `border-l ${dividerBorder} h-full`} ${className}`}
			role="separator"
			{...props}
		/>
	);
}