import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface Props<T> {
  value: T | null;
  options: T[];
  onChange: (value: T) => void;
  /** Returns a stable React key for each option. */
  keyOf: (item: T) => string | number;
  /** Renders the content inside the trigger button for the currently selected value. */
  renderSelected: (value: T) => ReactNode;
  /** Renders the content inside each option row. */
  renderOption: (item: T) => ReactNode;
  /** Equality check used to filter out the selected item. Defaults to `===`. */
  isEqual?: (a: T, b: T) => boolean;
  /** Disables the trigger button. */
  disabled?: boolean;
  /** Shown in the trigger when value is null. */
  placeholder?: ReactNode;
  /** Render the options list inline (expanding, pushing content down) instead of as a floating overlay. */
  inline?: boolean;
}

export function DropdownSelector<T>({
  value,
  options,
  onChange,
  keyOf,
  renderSelected,
  renderOption,
  isEqual = (a, b) => a === b,
  disabled,
  placeholder,
  inline,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const others = value !== null
    ? options.filter((o) => !isEqual(o, value))
    : [...options];

  useEffect(() => {
    if (inline || !open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [inline, open]);

  return (
    <div
      ref={ref}
      className={`flex-1 border bg-[#0a0c10] transition-colors border-slate-700/60${!inline ? " relative" + (open ? " rounded-t-lg rounded-b-none" : " rounded-lg") : " rounded-lg overflow-hidden"}`}
    >
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed${inline ? "" : open ? " rounded-t-lg" : " rounded-lg"}`}
      >
        {value !== null ? renderSelected(value) : placeholder ?? <span className="text-xs text-slate-600 italic">No value</span>}
        {options.length > 0 && (
          <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
        )}
      </button>

      {/* Options */}
      {open && others.length > 0 && (
        <div className={!inline
          ? "absolute left-[-1px] right-[-1px] top-full z-50 rounded-b-lg border border-slate-700/60 bg-[#0a0c10] overflow-hidden"
          : "border-t border-slate-700/60"
        }>
          {others.map((opt) => (
            <button
              key={keyOf(opt)}
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/40 border-b border-slate-700/30 last:border-b-0 text-left transition-colors"
            >
              {renderOption(opt)}
            </button>
          ))}
        </div>
      )}
      {open && others.length === 0 && (
        <div className={!inline
          ? "absolute left-[-1px] right-[-1px] top-full z-50 rounded-b-lg border border-slate-700/60 bg-[#0a0c10] px-2 py-1.5 text-xs text-slate-600 italic"
          : "border-t border-slate-700/60 px-2 py-1.5 text-xs text-slate-600 italic"
        }>
          No other options available
        </div>
      )}
    </div>
  );
}
