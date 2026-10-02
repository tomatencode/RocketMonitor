import type { ComponentType, ReactNode, SVGProps } from "react";

export type IconBadgeTone = "neutral" | "active" | "muted" | "ok" | "danger";
export type IconBadgeSize = "sm" | "md";

interface IconBadgeProps {
    /**
     * Character to render inside the box, e.g. "◉", "✸" or a channel number.
     * Ignored when `icon` is provided.
     */
    char?: ReactNode;
    /** SVG icon component. Sized by `iconClassName` and coloured by `color` (via currentColor). */
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
    /** Arbitrary CSS colour for the glyph/icon. Overrides the tone's text colour. */
    color?: string;
    /** Visual tone of the badge box. Defaults to "neutral". */
    tone?: IconBadgeTone;
    /** Render a text glyph in bold — used for numeric badges. */
    bold?: boolean;
    /** Dim the glyph/icon only, e.g. unselected dropdown rows. */
    dim?: boolean;
    /** Size class applied to the `icon` component. Defaults to "h-4 w-4". */
    iconClassName?: string;
    className?: string;
}

const toneStyles: Record<IconBadgeTone, string> = {
    neutral: "border-zinc-700/60 bg-zinc-800/60 text-zinc-300",
    active: "border-zinc-600/70 bg-zinc-800/70 text-zinc-100",
    muted: "border-zinc-700/50 bg-zinc-800/40 text-zinc-500",
    ok: "border-emerald-700/60 bg-emerald-950/50 text-emerald-300",
    danger: "border-red-700/60 bg-red-950/60 text-red-300",
};

/**
 * Square badge that frames a small glyph — a character (`char`) or a
 * monochrome SVG icon component (`icon`).
 *
 * Shared by the panel headers, the panel-set selector and the pyro channel
 * rows so every badge in the app has the same rounded border box. The icon
 * picks up its colour from `color` (SVGs must use `currentColor`), otherwise
 * from the tone's text colour.
 */
export function IconBadge({
    char,
    icon: Icon,
    color,
    tone = "neutral",
    bold = false,
    dim = false,
    iconClassName = "h-4 w-4",
    className = "",
}: IconBadgeProps) {
    const content: ReactNode = Icon ? (
        <Icon className={`${iconClassName}${dim ? " opacity-70" : ""}`} />
    ) : dim ? (
        <span className="opacity-70">{char}</span>
    ) : (
        char
    );

    return (
        <span
            aria-hidden
            style={color ? { color } : undefined}
            className={`flex shrink-0 items-center justify-center rounded-md border leading-none h-7 w-7 text-sm ${toneStyles[tone]} ${bold ? "font-bold" : ""} ${className}`}
        >
            {content}
        </span>
    );
}
