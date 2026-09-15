import type { ComponentPropsWithRef, ReactNode } from "react";
import { radius } from "../../styles";

interface AccentRowProps extends ComponentPropsWithRef<"div"> {
    children: ReactNode;
    accent?: string;
}

// A row with a colored left border, used to tint/link related items (e.g. by id) in a list
export function AccentRow({ children, accent = "border-transparent", className = "", ...props }: AccentRowProps) {
    return (
        <div className={`border-l-2 ${radius} ${accent} ${className}`} {...props}>
            {children}
        </div>
    );
}
