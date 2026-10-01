import type { ComponentType, SVGProps } from "react";
import { accentColor1, accentColor2 } from "../../shared/styles";
import LaunchPanels from "./Sets/LaunchPanels";
import TestPanels from "./Sets/TestPanels";
import { LaunchIcon, TestIcon } from "./PanelSetIcons";

/** A monochrome SVG icon used to represent a panel set in the selector. */
export type PanelSetIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** A switchable group of control panels shown on the main screen. */
export interface PanelSet {
    /** Stable identifier used for selection and as the dropdown key. */
    id: string;
    /** Human-readable name shown in the dropdown trigger and options. */
    label: string;
    /** Optional short description shown beneath the label in the dropdown options. */
    description?: string;
    /** SVG icon shown in the set's icon badge. */
    icon: PanelSetIcon;
    /** Accent colour applied to the set's icon. */
    color: string;
    /** The component that renders this set's panels. */
    Component: ComponentType;
}

/**
 * Registry of every panel set the user can switch between.
 *
 * To add a new set: create its component and append an entry here. The
 * dropdown and the render logic both read from this list, so no other
 * changes are needed.
 */
export const PANEL_SETS: PanelSet[] = [
    {
        id: "launch",
        label: "Launch",
        description: "Flight-ready readouts",
        icon: LaunchIcon,
        color: accentColor1,
        Component: LaunchPanels,
    },
    {
        id: "test",
        label: "Test",
        description: "Full sensor & actuator set",
        icon: TestIcon,
        color: accentColor2,
        Component: TestPanels,
    },
];

/** Id of the set shown on first load. */
export const DEFAULT_PANEL_SET_ID = PANEL_SETS[0].id;

/** Look up a panel set by id, falling back to the default set. */
export function getPanelSet(id: string): PanelSet {
    return PANEL_SETS.find((set) => set.id === id) ?? PANEL_SETS[0];
}
