import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { appBackground, dividerBorder, radius } from "../../../shared/styles";
import { Button } from "../../../shared/components/primitives/Button";
import { Card } from "../../../shared/components/primitives/Card";

export function LogWindow({ title, titleButtons, children }: { title: string; titleButtons: { label: string; onClick: () => void }[]; children: React.ReactNode }) {
    return (
        <div className={`flex h-screen flex-col overflow-hidden ${radius} ${appBackground}`}>
            <Card className="flex flex-1 flex-col overflow-hidden text-zinc-200 font-mono text-sm">
                <LogTitleBar title={title} buttons={titleButtons} />
                <div className="flex flex-1 flex-col min-h-0 bg-zinc-700/20">{children}</div>
            </Card>
        </div>
    );
}

interface LogTitleBarProps {
    title: string;
    buttons: { label: string; onClick: () => void }[];
}

function LogTitleBar({ title, buttons }: LogTitleBarProps) {
    const appWindow = useRef(getCurrentWindow());

    useEffect(() => {
        const window = appWindow.current;
        void window.isMaximized();
        let cleanup: (() => void) | undefined;
        void window.onResized(() => { void window.isMaximized(); }).then(unlisten => { cleanup = unlisten; });
        return () => { cleanup?.(); };
    }, []);

    return (
        <div data-tauri-drag-region className={`flex h-9 items-center bg-zinc-700/20 border-b ${dividerBorder} select-none shrink-0`}>
            <div data-tauri-drag-region className="flex shrink-0 items-center gap-1.5 px-2">
                {buttons.map(({ label, onClick }, index) => (
                    <Button key={index} variant="ghost" className="shrink-0 px-2.5 py-1 text-xs" onClick={onClick}>{label}</Button>
                ))}
            </div>

            <div data-tauri-drag-region className="flex flex-1 min-w-0 h-full items-center justify-center">
                <span data-tauri-drag-region className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">{title}</span>
            </div>

            <div data-tauri-drag-region className="flex shrink-0 items-center justify-end gap-1.5 px-2">
                <button onClick={() => void appWindow.current.close()} title="Close" tabIndex={-1} className={`group flex h-7 w-7 items-center justify-center ${radius} text-zinc-500 transition-colors hover:bg-zinc-700/60 hover:text-zinc-200`}>
                     <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                </button>
            </div>
        </div>
    );
}