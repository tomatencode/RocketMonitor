// Shared button visual styles.
// These cover colour, border, shadow, text colour, and disabled state.
// Callers add layout (flex, gap), spacing (px-*, py-*), text size, and width.

export const btnBlue =
  "bg-blue-700/80 hover:bg-blue-600/80 border border-blue-600/60 hover:border-blue-500 rounded-lg font-semibold text-blue-100 transition-colors shadow-sm shadow-blue-900/30 disabled:opacity-40 disabled:pointer-events-none";

export const btnSlate =
  "bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none";

export const btnGhost =
  "bg-transparent hover:bg-slate-800 border border-slate-700 rounded-lg font-medium text-slate-400 transition-colors";

export const btnGreen =
  "bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30 disabled:opacity-40 disabled:pointer-events-none";

export const btnYellow =
  "bg-yellow-700/80 hover:bg-yellow-600/80 border border-yellow-600/60 hover:border-yellow-500 rounded-lg font-semibold text-yellow-100 transition-colors shadow-sm shadow-yellow-900/30";

export const btnRed =
  "bg-red-900/60 hover:bg-red-800/60 border border-red-800/60 hover:border-red-700 rounded-lg font-semibold text-red-300 hover:text-red-200 transition-colors shadow-sm shadow-red-950/30";
