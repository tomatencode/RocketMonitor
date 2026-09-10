// Shared button visual styles.
// These cover colour, border, shadow, text colour, and disabled state.
// Callers add layout (flex, gap), spacing (px-*, py-*), text size, and width.

export const appBackground = "bg-[#0b0b0b]";
export const radius = "rounded-lg";
export const outerCardBackground = "bg-zinc-800/20";
export const innerCardBackground = "bg-zinc-800/40";
export const inputBackground = "bg-zinc-900/60";
export const logBackground = "bg-zinc-900/60";
export const filterBackground = "bg-zinc-700/60";
export const dropdownBackground = "bg-[#090909]";
export const dropdownHoverBackground = "hover:bg-zinc-800/40";

export const dividerBorder = "border-zinc-700/50";
export const outerCardBorder = "border-zinc-700/50";
export const inputBorder = "border-zinc-600";
export const filterBorder = "border-zinc-600";
export const mutedBorder = "border-zinc-700";
export const dropdownItemBorder = "border-zinc-700/30";
export const outerCard = `${outerCardBackground} border ${outerCardBorder} ${radius}`;
export const innerCard = `${innerCardBackground} ${radius}`;

export const btnBlue =
  `bg-zinc-700/80 hover:bg-zinc-600/80 border border-zinc-600/60 hover:border-zinc-500 ${radius} font-semibold text-zinc-100 transition-colors shadow-sm shadow-zinc-950/30 disabled:opacity-40 disabled:pointer-events-none`;

export const btnSlate =
  `bg-zinc-700/60 hover:bg-zinc-600/60 border border-zinc-600/60 hover:border-zinc-500 ${radius} font-semibold text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none`;

export const btnGhost =
  `bg-transparent hover:bg-zinc-800 border border-zinc-700 ${radius} font-medium text-zinc-400 transition-colors`;

export const btnGreen =
  `bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 ${radius} font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30 disabled:opacity-40 disabled:pointer-events-none`;

export const btnYellow =
  `bg-yellow-700/80 hover:bg-yellow-600/80 border border-yellow-600/60 hover:border-yellow-500 ${radius} font-semibold text-yellow-100 transition-colors shadow-sm shadow-yellow-900/30 disabled:opacity-40 disabled:pointer-events-none`;

export const btnRed =
  `bg-red-900/60 hover:bg-red-800/60 border border-red-800/60 hover:border-red-700 ${radius} font-semibold text-red-300 hover:text-red-200 transition-colors shadow-sm shadow-red-950/30 disabled:opacity-40 disabled:pointer-events-none`;
