import type { SVGProps } from "react";

/**
 * Shared base for the app's monochrome SVG icons: a 24×24 stroke drawing that
 * inherits its colour from the surrounding text via `stroke="currentColor"`.
 *
 * Pass a size class such as `h-4 w-4` (the default) to control dimensions —
 * that is how `IconBadge` sizes an icon inside its badge box.
 */
export function IconBase({ className = "h-4 w-4", children, ...props }: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            {children}
        </svg>
    );
}

/** Axes with a plotted series — header icon for the line-graph sensor panels. */
export function LineChartIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M3.5 3v17.5h17" />
            <path d="M6.5 15l4-5 3 2.5 4.5-7" />
        </IconBase>
    );
}

/** Speaker emitting sound waves — header icon for the buzzer panel. */
export function BuzzerIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z" />
            <path d="M15.5 9.6a3.5 3.5 0 0 1 0 4.8" />
            <path d="M18 7.5a6.5 6.5 0 0 1 0 9" />
        </IconBase>
    );
}
