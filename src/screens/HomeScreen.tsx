import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { btnBlue, btnGhost, btnGreen, btnRed, btnSlate } from "../shared/styles";

type LogEntry = { dir: "tx" | "rx" | "info" | "error"; text: string; time: string };

function timestamp() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function toHex(bytes: number[]) {
    return bytes.map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function parseHex(input: string): number[] | null {
    const tokens = input.trim().split(/\s+/);
    const bytes = tokens.map(t => parseInt(t, 16));
    return bytes.some(b => isNaN(b) || b < 0 || b > 255) ? null : bytes;
}

export default function HomeScreen() {
    const [connected, setConnected] = useState(false);
    const [portName, setPortName] = useState<string | null>(null);
    const [sendInput, setSendInput] = useState("");
    const [log, setLog] = useState<LogEntry[]>([]);
    const [polling, setPolling] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    function addLog(dir: LogEntry["dir"], text: string) {
        setLog(prev => [...prev, { dir, text, time: timestamp() }]);
    }

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [log]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setPolling(false);
    }, []);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(async () => {
            try {
                const bytes = await invoke<number[]>("rocket_link_read");
                if (bytes.length > 0)
                    setLog(prev => [...prev, { dir: "rx", text: toHex(bytes), time: timestamp() }]);
            } catch { /* ignore transient read errors while polling */ }
        }, 100);
        setPolling(true);
    }, []);

    async function handleFind() {
        addLog("info", "Searching for RocketLink...");
        try {
            const port = await invoke<string>("rocket_link_find");
            setPortName(port);
            addLog("info", `Found on ${port}`);
        } catch (e) { addLog("error", String(e)); }
    }

    async function handleConnect() {
        if (!portName) return;
        try {
            await invoke("rocket_link_connect", { portName });
            setConnected(true);
            addLog("info", `Connected to ${portName}`);
        } catch (e) { addLog("error", String(e)); }
    }

    async function handleDisconnect() {
        await invoke("rocket_link_disconnect");
        setConnected(false);
        stopPolling();
        addLog("info", "Disconnected");
    }

    async function handleSend() {
        const bytes = parseHex(sendInput);
        if (!bytes || bytes.length === 0) { addLog("error", "Invalid hex input"); return; }
        try {
            await invoke("rocket_link_send", { data: bytes });
            addLog("tx", toHex(bytes));
        } catch (e) { addLog("error", String(e)); }
    }

    async function handleRead() {
        try {
            const bytes = await invoke<number[]>("rocket_link_read");
            if (bytes.length > 0) addLog("rx", toHex(bytes));
            else addLog("info", "No data");
        } catch (e) { addLog("error", String(e)); }
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1017] text-slate-200 p-4 gap-4 font-mono text-sm">

            {/* Header / status */}
            <div className="flex items-center gap-3">
                <span className="text-base font-semibold tracking-wide text-slate-100">RocketLink Test</span>
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-slate-600"}`} />
                <span className={`text-xs ${connected ? "text-green-400" : "text-slate-500"}`}>
                    {connected ? `connected · ${portName}` : "disconnected"}
                </span>
            </div>

            {/* Connection controls */}
            <div className="flex flex-wrap gap-2">
                <button className={`${btnSlate} px-3 py-1.5 text-xs`} onClick={handleFind} disabled={connected}>
                    Find Device
                </button>
                <button className={`${btnGreen} px-3 py-1.5 text-xs`} onClick={handleConnect} disabled={!portName || connected}>
                    Connect{portName ? ` (${portName})` : ""}
                </button>
                <button className={`${btnRed} px-3 py-1.5 text-xs`} onClick={handleDisconnect} disabled={!connected}>
                    Disconnect
                </button>
            </div>

            {/* Send row */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={sendInput}
                    onChange={e => setSendInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder="hex bytes  e.g.  AA 01 00 01"
                    disabled={!connected}
                    className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                />
                <button className={`${btnBlue} px-3 py-1.5 text-xs`} onClick={handleSend} disabled={!connected || !sendInput.trim()}>
                    Send
                </button>
                <button className={`${btnSlate} px-3 py-1.5 text-xs`} onClick={handleRead} disabled={!connected || polling}>
                    Read
                </button>
                <button className={`${polling ? btnRed : btnSlate} px-3 py-1.5 text-xs`} onClick={polling ? stopPolling : startPolling} disabled={!connected}>
                    {polling ? "Stop Poll" : "Poll"}
                </button>
            </div>

            {/* Log */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-1">
                {log.length === 0 && <span className="text-slate-600 text-xs">Log is empty.</span>}
                {log.map((entry, i) => (
                    <div key={i} className="flex gap-2 text-xs leading-relaxed">
                        <span className="text-slate-600 shrink-0">{entry.time}</span>
                        <span className={
                            entry.dir === "tx" ? "text-blue-400 shrink-0" :
                            entry.dir === "rx" ? "text-green-400 shrink-0" :
                            entry.dir === "error" ? "text-red-400 shrink-0" :
                            "text-slate-500 shrink-0"
                        }>
                            {entry.dir === "tx" ? "TX" : entry.dir === "rx" ? "RX" : entry.dir === "error" ? "ERR" : "---"}
                        </span>
                        <span className={entry.dir === "error" ? "text-red-300" : "text-slate-200 break-all"}>
                            {entry.text}
                        </span>
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>

            <button className={`${btnGhost} px-3 py-1.5 text-xs self-start`} onClick={() => setLog([])}>
                Clear Log
            </button>
        </div>
    );
}