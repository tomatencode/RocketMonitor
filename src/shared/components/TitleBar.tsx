import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function TitleBar() {
  const appWindow = useRef(getCurrentWindow());
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const win = appWindow.current;
    win.isMaximized().then(setIsMaximized);
    let cleanup: (() => void) | undefined;
    win.onResized(() => {
      win.isMaximized().then(setIsMaximized);
    }).then((unlisten) => { cleanup = unlisten; });
    return () => { cleanup?.(); };
  }, []);

  async function handleMinimize() {
    await appWindow.current.minimize();
  }

  async function handleMaximize() {
    const win = appWindow.current;
    await win.toggleMaximize();
  }

  async function handleClose() {
    await appWindow.current.close();
  }

  return (
    <div className="flex items-center h-9 bg-[#0d1017] border-b border-slate-700/60 select-none shrink-0">

      {/* Drag region — sibling to controls, NOT a parent of the buttons */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center px-4"
      >
        <span className="text-xs shrink-0 font-semibold tracking-widest text-slate-600 uppercase pointer-events-none">
          Roicket Monitor
        </span>
      </div>

      {/* Window controls — outside the drag region */}
      <div className="flex items-center gap-1.5 px-2">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="group w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-700/60 transition-colors"
          title="Minimize"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-200 transition-colors" viewBox="0 0 12 2" fill="currentColor">
            <rect width="12" height="1.5" rx="0.75" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="group w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-700/60 transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
          tabIndex={-1}
        >
          {isMaximized ? (
            <svg className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="1" width="8" height="8" rx="1" />
              <path d="M1 4v6a1 1 0 0 0 1 1h6" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="group w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-600/80 transition-colors"
          title="Close"
          tabIndex={-1}
        >
          <svg className="w-3 h-3 text-slate-500 group-hover:text-white transition-colors" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
