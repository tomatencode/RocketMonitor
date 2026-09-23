import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useRocketLink } from "../../features/RocketLink/RocketLinkContext";
import { appBackground, dividerBorder } from "../styles";
import { useRadioLink } from "../../features/RadioLink/RadioLinkContext";

export default function TitleBar() {
  const appWindow = useRef(getCurrentWindow());
  const [isMaximized, setIsMaximized] = useState(false);
  const { connected: usbConnected, portName, hc12Alive } = useRocketLink();
  const { connected: rocketConnected } = useRadioLink();

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

  async function handleOpenLog(window: "rocket" | "radio") {
    await invoke("open_log_window", { window });
  }

  return (
    <div className={`relative flex items-center h-9 ${appBackground} border-b ${dividerBorder} select-none shrink-0`}>

      {/* Full-width drag region */}
      <div data-tauri-drag-region className="absolute inset-0" />

      {/* Centered title */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Rocket Monitor
        </span>
      </div>

      {/* Top-left status indicators — above drag region */}
      <div className="relative z-10 flex items-center gap-2 px-3">
        <button
          onClick={() => handleOpenLog("rocket")}
          className="flex items-center"
          title={!usbConnected ? "Not connected" : !hc12Alive ? `HC12 module not responding: ${portName}` : `Connected: ${portName}`}
        >
          <svg
            viewBox="0 0 56 40"
            className={`w-6 ${!usbConnected ? "text-zinc-600" : !hc12Alive ? "text-red-400" : "text-green-400"}`}
          >
            <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
              <line x1="8" y1="20" x2="50" y2="20" />
              <line x1="22" y1="20" x2="36" y2="7" />
              <line x1="22" y1="20" x2="38" y2="34" />
            </g>
            <g fill="currentColor" stroke="none">
              <polygon points="48,13 48,27 56,20" />
              <circle cx="8" cy="20" r="6.5" />
              <circle cx="36" cy="7" r="4" />
              <rect x="34" y="30" width="7" height="7" />
            </g>
          </svg>
        </button>

        <button
          onClick={() => handleOpenLog("radio")}
          className="flex items-center"
          title={rocketConnected ? "Radio connected" : "Radio disconnected"}
        >
          <svg
            viewBox="0 0 56 40"
            className={`w-8 ${rocketConnected ? "text-green-400" : "text-zinc-600"}`}
            aria-hidden="true"
          >
            <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
              <path d="M 15 8 A 20 20 0 0 0 15 32" />
              <path d="M 19 14 A 15 15 0 0 0 19 26" />
              <path d="M 41 8 A 20 20 0 0 1 41 32" />
              <path d="M 37 14 A 15 15 0 0 1 37 26" />
            </g>
            <g fill="currentColor" stroke="none">
              <circle cx="28" cy="20" r="5.5" />
            </g>
          </svg>
        </button>
      </div>

      {/* Window controls — above drag region */}
      <div className="relative z-10 ml-auto flex items-center gap-1.5 px-2">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="group w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-700/60 transition-colors"
          title="Minimize"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 transition-colors" viewBox="0 0 12 2" fill="currentColor">
            <rect width="12" height="1.5" rx="0.75" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="group w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-700/60 transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
          tabIndex={-1}
        >
          {isMaximized ? (
            <svg className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 transition-colors" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="1" width="8" height="8" rx="1" />
              <path d="M1 4v6a1 1 0 0 0 1 1h6" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 transition-colors" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="group w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/70 transition-colors"
          title="Close"
          tabIndex={-1}
        >
          <svg className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200 transition-colors" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
