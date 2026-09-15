import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { appBackground, dividerBorder, radius } from "../../../shared/styles";

export function LogWindow({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className={`flex h-screen flex-col overflow-hidden ${radius} ${appBackground} text-zinc-200 font-mono text-sm`}>
            <LogTitleBar title={title} />
            <div className="flex flex-1 flex-col min-h-0 bg-zinc-700/20">{children}</div>
        </div>
    );
}

function LogTitleBar({ title }: { title: string }) {
    const appWindow = useRef(getCurrentWindow());
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const window = appWindow.current;
        void window.isMaximized().then(setIsMaximized);
        let cleanup: (() => void) | undefined;
        void window.onResized(() => { void window.isMaximized().then(setIsMaximized); }).then(unlisten => { cleanup = unlisten; });
        return () => { cleanup?.(); };
    }, []);

    return (
        <div className={`relative flex h-9 items-center bg-zinc-700/20 border-b ${dividerBorder} select-none shrink-0`}>
            <div data-tauri-drag-region className="absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">{title}</span>
            </div>
            <div className="relative z-10 ml-auto flex items-center gap-1.5 px-2">
                <TitleBarButton title="Minimize" onClick={() => void appWindow.current.minimize()}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 12 2" fill="currentColor"><rect width="12" height="1.5" rx="0.75" /></svg>
                </TitleBarButton>
                <TitleBarButton title={isMaximized ? "Restore" : "Maximize"} onClick={() => void appWindow.current.toggleMaximize()}>
                    {isMaximized ? (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="1" width="8" height="8" rx="1" /><path d="M1 4v6a1 1 0 0 0 1 1h6" /></svg>
                    ) : (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="10" height="10" rx="1.5" /></svg>
                    )}
                </TitleBarButton>
                <TitleBarButton title="Close" danger onClick={() => void appWindow.current.close()}>
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                </TitleBarButton>
            </div>
        </div>
    );
}

function TitleBarButton({ title, danger = false, onClick, children }: { title: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} title={title} tabIndex={-1} className={`group flex h-7 w-7 items-center justify-center ${radius} text-zinc-500 transition-colors ${danger ? "hover:bg-red-500/70 hover:text-zinc-200" : "hover:bg-zinc-700/60 hover:text-zinc-200"}`}>
            {children}
        </button>
    );
}