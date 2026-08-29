import { useCallback, useEffect, useRef, useState } from "react";
import { useRocketLink } from "../features/RocketLink/RocketLinkContext";
import { btnBlue, btnGhost, btnGreen, btnRed, btnSlate, btnYellow } from "../shared/styles";

// ─── Command definitions ──────────────────────────────────────────────────────
// Add new commands here. Params are rendered automatically as inputs.
type NumberParam = { kind: "number"; label: string; unit?: string; min?: number; max?: number; step?: number; default: number };
type SelectParam  = { kind: "select";  label: string; options: { label: string; value: number }[]; default: number };
type ParamDef = NumberParam | SelectParam;

type CommandDef = { id: string; label: string; params?: ParamDef[] };

const COMMANDS: CommandDef[] = [
    {
        id: "gimbal_move",
        label: "Move Gimbal",
        params: [
            { kind: "number", label: "X", unit: "°", min: -12, max: 12, step: 0.5, default: 0 },
            { kind: "number", label: "Y", unit: "°", min: -12, max: 12, step: 0.5, default: 0 },
        ],
    },
    {
        id: "telemetry",
        label: "Request Telemetry",
    },
    {
        id: "arm",
        label: "Arm",
    },
    {
        id: "disarm",
        label: "Disarm",
    },
];
// ─────────────────────────────────────────────────────────────────────────────

type LogEntry = { dir: "tx" | "rx" | "info" | "error"; text: string; time: string };

function timestamp() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function CommandCard({ cmd, connected, onSend }: {
    cmd: CommandDef;
    connected: boolean;
    onSend: (cmd: CommandDef, params: Record<number, number>) => void;
}) {
    const [params, setParams] = useState<Record<number, number>>(
        () => Object.fromEntries((cmd.params ?? []).map((p, i) => [i, p.default]))
    );

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300 tracking-wide">{cmd.label}</span>
            {cmd.params && (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {cmd.params.map((p, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">{p.label}</span>
                            {p.kind === "number" ? (
                                <input
                                    type="number"
                                    value={params[i]}
                                    min={p.min} max={p.max} step={p.step}
                                    onChange={e => setParams(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                                    className="w-20 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                            ) : (
                                <select
                                    value={params[i]}
                                    onChange={e => setParams(prev => ({ ...prev, [i]: parseInt(e.target.value) }))}
                                    className="bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                >
                                    {p.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            )}
                            {p.kind === "number" && p.unit && <span className="text-xs text-slate-600">{p.unit}</span>}
                        </div>
                    ))}
                </div>
            )}
            <button
                className={`${btnSlate} px-3 py-1 text-xs self-start`}
                disabled={!connected}
                onClick={() => onSend(cmd, params)}
            >
                Send
            </button>
        </div>
    );
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
    const { connected, portName, send, receive } = useRocketLink();
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
                const bytes = await receive();
                if (bytes.length > 0)
                    setLog(prev => [...prev, { dir: "rx", text: toHex(bytes), time: timestamp() }]);
            } catch { /* ignore transient read errors while polling */ }
        }, 100);
        setPolling(true);
    }, [receive]);

    async function handleRawSend() {
        const bytes = parseHex(sendInput);
        if (!bytes || bytes.length === 0) { addLog("error", "Invalid hex input"); return; }
        try {
            await send(bytes);
            addLog("tx", toHex(bytes));
        } catch (e) { addLog("error", String(e)); }
    }

    async function handleRead() {
        try {
            const bytes = await receive();
            if (bytes.length > 0) addLog("rx", toHex(bytes));
            else addLog("info", "No data");
        } catch (e) { addLog("error", String(e)); }
    }

    function handleCommandSend(cmd: CommandDef, params: Record<number, number>) {
        // TODO: build and send the actual packet for this command
        const paramDesc = cmd.params
            ?.map((p, i) => `${p.label}=${params[i]}${p.kind === "number" && p.unit ? p.unit : ""}`)
            .join("  ") ?? "";
        addLog("info", `[${cmd.label}]${paramDesc ? "  " + paramDesc : ""}  — not yet implemented`);
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1017] text-slate-200 font-mono text-sm overflow-hidden">

            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-slate-700/60 shrink-0">
                <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">RocketLink</span>
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-slate-600"}`} />
                <span className={`text-xs ${connected ? "text-green-400" : "text-slate-500"}`}>
                    {connected ? portName : "disconnected"}
                </span>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0">

                {/* Left: command cards */}
                <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto p-3 border-r border-slate-700/60">
                    <span className="text-xs text-slate-600 uppercase tracking-widest px-1 pb-1">Commands</span>
                    {COMMANDS.map(cmd => (
                        <CommandCard key={cmd.id} cmd={cmd} connected={connected} onSend={handleCommandSend} />
                    ))}
                </div>

                {/* Right: log + raw send */}
                <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">

                    {/* Log */}
                    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-0.5">
                        {log.length === 0 && <span className="text-slate-600 text-xs">Log is empty.</span>}
                        {log.map((entry, i) => (
                            <div key={i} className="flex gap-2 text-xs leading-relaxed">
                                <span className="text-slate-600 shrink-0">{entry.time}</span>
                                <span className={
                                    entry.dir === "tx"    ? "text-blue-400  shrink-0 w-7" :
                                    entry.dir === "rx"    ? "text-green-400 shrink-0 w-7" :
                                    entry.dir === "error" ? "text-red-400   shrink-0 w-7" :
                                                            "text-slate-500 shrink-0 w-7"
                                }>
                                    {entry.dir === "tx" ? "TX" : entry.dir === "rx" ? "RX" : entry.dir === "error" ? "ERR" : "---"}
                                </span>
                                <span className={entry.dir === "error" ? "text-red-300 break-all" : "text-slate-200 break-all"}>
                                    {entry.text}
                                </span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>

                    {/* Raw hex send row */}
                    <div className="flex gap-2 shrink-0">
                        <input
                            type="text"
                            value={sendInput}
                            onChange={e => setSendInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleRawSend()}
                            placeholder="raw hex  e.g.  AA 01 00 01"
                            disabled={!connected}
                            className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                        />
                        <button className={`${btnBlue} px-3 py-1.5 text-xs`} onClick={handleRawSend} disabled={!connected || !sendInput.trim()}>Send</button>
                        <button className={`${btnSlate} px-3 py-1.5 text-xs`} onClick={handleRead} disabled={!connected || polling}>Read</button>
                        <button className={`${polling ? btnYellow : btnSlate} px-3 py-1.5 text-xs`} onClick={polling ? stopPolling : startPolling} disabled={!connected}>
                            {polling ? "Stop Poll" : "Poll"}
                        </button>
                        <button className={`${btnGhost} px-3 py-1.5 text-xs`} onClick={() => setLog([])}>Clear</button>
                    </div>
                </div>
            </div>
        </div>
    );
}