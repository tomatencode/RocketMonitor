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

/** Glowing light bulb — header icon for the LED panel. */
export function LedIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M12 3a6 6 0 0 0-4 10.5c.6.7 1 1.5 1 2.5h6c0-1 .4-1.8 1-2.5A6 6 0 0 0 12 3z" />
            <path d="M9.5 18.5h5" />
            <path d="M10.5 21h3" />
        </IconBase>
    );
}

/** Battery cell with charge bars — header icon for the battery panel. */
export function BatteryIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <rect x="2.5" y="7" width="16" height="10" rx="2" />
            <path d="M21 10v4" />
            <path d="M6.5 10.5v3" />
            <path d="M10 10.5v3" />
            <path d="M13.5 10.5v3" />
        </IconBase>
    );
}

/** Circular arrow — header icon for the rotation/attitude panel. */
export function RotationIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M19.9 12a8 8 0 1 1-2.4-5.7" />
            <path d="M20 5.5V10h-4.5" />
        </IconBase>
    );
}

/** Three horizontal sliders — header icon for the PID tuning panel. */
export function PidIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M4 7h16" />
            <circle cx="9" cy="7" r="2" />
            <path d="M4 12h16" />
            <circle cx="15" cy="12" r="2" />
            <path d="M4 17h16" />
            <circle cx="8" cy="17" r="2" />
        </IconBase>
    );
}
