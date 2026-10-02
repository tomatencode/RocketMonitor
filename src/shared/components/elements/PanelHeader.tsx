import type { ReactNode } from "react";
import { IconBadge } from "./IconBadge";

interface PanelHeaderProps {
    /** ASCII character or pre-built SVG node shown in the badge. */
    icon: ReactNode;
    title: string;
    subtitle?: string;
    /** Right-aligned content, e.g. a StatusPill. */
    end?: ReactNode;
    /** Tone of the icon badge + header text. */
    alert?: boolean;
    connected?: boolean;
    className?: string;
}

/**
 * Standard panel header: square icon badge, uppercase title, mono subtitle,
 * optional right-aligned end content (usually a StatusPill).
 */
export function PanelHeader({ icon, title, subtitle, end, alert = false, connected = true, className = "" }: PanelHeaderProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <IconBadge tone={alert ? "danger" : "neutral"} char={icon} />
            <div className="flex min-w-0 flex-col">
                <span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-200" : "text-zinc-500"}`}>
                    {title}
                </span>
                {subtitle && (
                    <span className="text-[10px] text-zinc-500 font-mono">{subtitle}</span>
                )}
            </div>
            {end && <div className="ml-auto flex shrink-0 items-center">{end}</div>}
        </div>
    );
}
