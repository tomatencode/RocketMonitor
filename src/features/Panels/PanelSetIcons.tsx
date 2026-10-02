import type { SVGProps } from "react";
import { IconBase } from "../../shared/components/elements/Icons";

/**
 * Monochrome SVG icons for the panel-set selector. They share `IconBase` with
 * the panel-header icons so every glyph in the app is drawn the same way.
 */

/** Rocket, used for the "Launch" panel set. */
export function LaunchIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M12 2c-2.5 2.2-4 5.6-4 9.5V15h8v-3.5c0-3.9-1.5-7.3-4-9.5z" />
            <circle cx="12" cy="9" r="1.75" />
            <path d="M8 13.5 5.5 16.5 8 15.5" />
            <path d="M16 13.5 18.5 16.5 16 15.5" />
        </IconBase>
    );
}

/** Flask, used for the "Test" panel set. */
export function TestIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <IconBase {...props}>
            <path d="M9 3h6" />
            <path d="M10 3v6l-4.3 8.4A2 2 0 0 0 7.5 20.5h9A2 2 0 0 0 18.3 17.4L14 9V3" />
            <path d="M7.2 15h9.6" />
        </IconBase>
    );
}
