import { useEffect, useMemo, useRef, useState } from "react";
import { useRocketLink } from "../features/RocketLink/RocketLinkContext";
import { PacketType } from "../features/RocketLink/Protocol";
import { btnBlue, btnGhost, btnGreen, btnYellow } from "../shared/styles";

type LogEntry = ReturnType<typeof useRocketLink>["log"][number];

function toHex(bytes: ArrayLike<number>) {
    return Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function parseHex(input: string): number[] | null {
    const tokens = input.trim().split(/\s+/);
    if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === "")) return [];
    const bytes = tokens.map(t => parseInt(t, 16));
    return bytes.some(b => isNaN(b) || b < 0 || b > 255) ? null : bytes;
}

function formatEntry(entry: LogEntry): { label: string; detail: string; isText: boolean } {
    if (entry.packet) {
        const typeName = PacketType[entry.packet.type] ?? `0x${entry.packet.type.toString(16).toUpperCase()}`;
        const isText = entry.packet.type === PacketType.AT_CMD || entry.packet.type === PacketType.AT_RESP;
        const detail = entry.packet.payload.length === 0
            ? ""
            : isText
                ? new TextDecoder().decode(entry.packet.payload)
                : toHex(entry.packet.payload);
        return { label: typeName, detail, isText };
    }
    return { label: "RAW", detail: toHex(entry.data ?? []), isText: false };
}

export default function RocketLinkTestScreen() {
    const { connected, sendRadio, receiveRadio, sendAT, log } = useRocketLink();

    const [radioInput, setRadioInput] = useState("DE AD BE EF");
    const [radioError, setRadioError] = useState<string | null>(null);

    const [rxTimeout, setRxTimeout] = useState(2000);
    const [rxError, setRxError] = useState<string | null>(null);

    const [atCommand, setAtCommand] = useState("AT+VER");
    const [atError, setAtError] = useState<string | null>(null);

    const [clearedAt, setClearedAt] = useState(0);
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
    const logEndRef = useRef<HTMLDivElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);

    const visibleLog = useMemo(() => log.filter(e => e.ts > clearedAt), [log, clearedAt]);
    const logTypes = useMemo(() => [...new Set(visibleLog.map(e => formatEntry(e).label))], [visibleLog]);
    const filteredLog = useMemo(
        () => visibleLog.filter(e => !hiddenTypes.has(formatEntry(e).label)),
        [visibleLog, hiddenTypes]
    );

    useEffect(() => {
        if (isAtBottomRef.current) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [filteredLog.length]);

    function handleLogScroll() {
        const el = logContainerRef.current;
        if (!el) return;
        isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    }

    async function handleSendRadio() {
        setRadioError(null);
        const bytes = parseHex(radioInput);
        if (bytes === null) { setRadioError("Invalid hex bytes"); return; }
        try {
            await sendRadio(bytes);
        } catch (e) {
            setRadioError(String(e));
        }
    }

    async function handleReceiveRadio() {
        setRxError(null);
        try {
            await receiveRadio(rxTimeout);
        } catch (e) {
            setRxError(String(e));
        }
    }

    async function handleSendAT() {
        setAtError(null);
        try {
            await sendAT(atCommand);
        } catch (e) {
            setAtError(String(e));
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1017] text-slate-200 font-mono text-sm overflow-hidden">
            {/* Body: controls on left, log on right */}
            <div className="flex flex-1 min-h-0">

                {/* Left: action cards */}
                <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto p-3 border-r border-slate-700/60">

                    {/* Send Radio */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-blue-300 tracking-wide uppercase">Send Radio</span>
                        <input
                            type="text"
                            value={radioInput}
                            onChange={e => { setRadioInput(e.target.value); setRadioError(null); }}
                            onKeyDown={e => e.key === "Enter" && handleSendRadio()}
                            placeholder="hex bytes  e.g.  DE AD BE EF"
                            disabled={!connected}
                            className="bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                        />
                        <button className={`${btnBlue} px-3 py-1.5 text-xs self-start`} onClick={handleSendRadio} disabled={!connected}>
                            Send Radio
                        </button>
                        {radioError  && <span className="text-xs text-red-400 break-all">{radioError}</span>}
                    </div>

                    {/* Receive Radio */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-green-300 tracking-wide uppercase">Receive Radio</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Timeout</span>
                            <input
                                type="number"
                                value={rxTimeout}
                                min={100}
                                max={10000}
                                step={100}
                                onChange={e => setRxTimeout(parseInt(e.target.value) || 2000)}
                                disabled={!connected}
                                className="w-24 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                            />
                            <span className="text-xs text-slate-600">ms</span>
                        </div>
                        <button className={`${btnGreen} px-3 py-1.5 text-xs self-start`} onClick={handleReceiveRadio} disabled={!connected}>
                            Receive Radio
                        </button>
                        {rxError && <span className="text-xs text-red-400 break-all">{rxError}</span>}
                    </div>

                    {/* Send AT Command */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-yellow-300 tracking-wide uppercase">AT Command</span>
                        <input
                            type="text"
                            value={atCommand}
                            onChange={e => { setAtCommand(e.target.value); setAtError(null); }}
                            onKeyDown={e => e.key === "Enter" && handleSendAT()}
                            placeholder="e.g.  AT+VER"
                            disabled={!connected}
                            className="bg-slate-900/60 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                        />
                        <button className={`${btnYellow} px-3 py-1.5 text-xs self-start`} onClick={handleSendAT} disabled={!connected}>
                            Send AT
                        </button>
                    </div>
                    {atError && <span className="text-xs text-red-400 break-all">{atError}</span>}
                </div>

                {/* Right: log */}
                <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
                    <div className="flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-600 uppercase tracking-widest">Packet Log</span>
                        <button className={`${btnGhost} px-2.5 py-1 text-xs`} onClick={() => setClearedAt(Date.now())}>
                            Clear
                        </button>
                    </div>
                    {logTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 shrink-0">
                            {logTypes.map(type => {
                                const hidden = hiddenTypes.has(type);
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setHiddenTypes(prev => {
                                            const next = new Set(prev);
                                            if (hidden) next.delete(type); else next.add(type);
                                            return next;
                                        })}
                                        className={`px-2 py-0.5 text-xs rounded border font-mono transition-colors ${
                                            hidden
                                                ? "border-slate-700 text-slate-600 line-through"
                                                : "bg-slate-700/60 border-slate-600 text-slate-300"
                                        }`}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div ref={logContainerRef} onScroll={handleLogScroll} className="flex-1 min-h-0 overflow-y-auto bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-1">
                        {filteredLog.length === 0 && (
                            <span className="text-slate-600 text-xs">
                                {visibleLog.length === 0 ? "No packets yet." : "No packets match the filter."}
                            </span>
                        )}
                        {filteredLog.map((entry, i) => {
                            const { label, detail, isText } = formatEntry(entry);
                            const isTx = entry.direction === "send";
                            return (
                                <div key={i} className="flex gap-2 text-xs leading-relaxed font-mono">
                                    <span className="text-slate-600 shrink-0 w-20">
                                        {new Date(entry.ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                        <span className="text-slate-700">
                                            .{String(entry.ts % 1000).padStart(3, "0")}
                                        </span>
                                    </span>
                                    <span className={`shrink-0 w-5 font-semibold ${isTx ? "text-blue-400" : "text-green-400"}`}>
                                        {isTx ? "↑" : "↓"}
                                    </span>
                                    <span className={`shrink-0 font-semibold ${isTx ? "text-blue-300" : "text-green-300"} min-w-[11rem]`}>
                                        {label}
                                    </span>
                                    {detail && (
                                        <span className={`break-all ${isText ? "text-yellow-200" : "text-slate-400"}`}>
                                            {detail}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={logEndRef} />
                    </div>
                </div>

            </div>
        </div>
    );
}
