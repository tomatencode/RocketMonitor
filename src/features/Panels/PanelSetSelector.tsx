import { useEffect, useRef, useState } from "react";
import { Card } from "../../shared/components/elements/Card";
import { dividerBorder } from "../../shared/styles";
import { PANEL_SETS, getPanelSet, type PanelSet, type PanelSetIcon } from "./panelSets";

export interface PanelSetSelectorProps {
    activeSetId: string;
    onChange: (id: string) => void;
}

/** Hover tint shared by the trigger and each option row. */
const rowHover = "hover:bg-zinc-800/40";

/**
 * Feature-specific card dropdown for switching panel sets.
 *
 * Intentionally separate from the generic `DropdownSelector` primitive so the
 * panel-set switch can present a richer card layout (icon badge, label,
 * description, chevron) without leaking that styling into shared primitives.
 */
export function PanelSetSelector({ activeSetId, onChange }: PanelSetSelectorProps) {
    const activeSet = getPanelSet(activeSetId);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const others = PANEL_SETS.filter((set) => set.id !== activeSetId);

    // Close on outside click or Escape while the options card is open.
    useEffect(() => {
        if (!open) return;
        function handlePointerDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    return (
        <div ref={ref} className="absolute top-3 left-1/2 z-20 w-64 -translate-x-1/2">
            {/* Trigger card */}
            <Card className="overflow-hidden p-0">
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    className={`flex w-full items-center gap-2.5 p-2.5 text-left transition-colors ${rowHover}`}
                >
                    <SetIcon icon={activeSet.icon} active />
                    <SetLabel set={activeSet} />
                    <ChevronIcon open={open} />
                </button>
            </Card>

            {/* Options card, stacked below the trigger with an identical row layout */}
            {open && (
                <Card role="listbox" className="mt-1.5 overflow-hidden p-0">
                    {others.length > 0 ? (
                        others.map((set) => (
                            <button
                                key={set.id}
                                type="button"
                                role="option"
                                aria-selected={false}
                                onClick={() => {
                                    onChange(set.id);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center gap-2.5 border-b p-2.5 text-left transition-colors last:border-b-0 ${dividerBorder} ${rowHover}`}
                            >
                                <SetIcon icon={set.icon} />
                                <SetLabel set={set} muted />
                            </button>
                        ))
                    ) : (
                        <div className="p-2.5 text-xs text-zinc-600 italic">No other panel sets</div>
                    )}
                </Card>
            )}
        </div>
    );
}

/** Square icon badge, matching the look of the control-panel headers. */
function SetIcon({ icon: Icon, active = false }: { icon: PanelSetIcon; active?: boolean }) {
    return (
        <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                active
                    ? "border-zinc-600/70 bg-zinc-800/70 text-zinc-100"
                    : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400"
            }`}
        >
            <Icon className="h-4 w-4" />
        </span>
    );
}

/** Label + optional description, used identically in the trigger and options. */
function SetLabel({ set, muted = false }: { set: PanelSet; muted?: boolean }) {
    return (
        <span className="flex min-w-0 flex-1 flex-col">
            <span
                className={`text-xs font-semibold tracking-wider uppercase ${
                    muted ? "text-zinc-300" : "text-zinc-100"
                }`}
            >
                {set.label}
            </span>
            {set.description && (
                <span className="truncate text-[10px] text-zinc-500">{set.description}</span>
            )}
        </span>
    );
}

/** Chevron that flips down/up to reflect the open state. */
function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
            <path d="M2 4l4 4 4-4" />
        </svg>
    );
}
