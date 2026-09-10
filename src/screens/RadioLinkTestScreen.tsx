import { useEffect, useMemo, useRef, useState } from "react";
import { PacketType } from "../features/RadioLink/Protocol";
import { useRadioLink } from "../features/RadioLink/RadioLinkContext";
import {
	appBackground,
	btnBlue,
	btnGhost,
	btnRed,
	btnYellow,
	dividerBorder,
	filterBackground,
	filterBorder,
	inputBackground,
	inputBorder,
	logBackground,
	mutedBorder,
	panelBackground,
	panelBorder,
} from "../shared/styles";

type LogEntry = ReturnType<typeof useRadioLink>["log"][number];

function toHex(bytes: ArrayLike<number>) {
	return Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function formatEntry(entry: LogEntry): { label: string; detail: string } {
	if (entry.packet) {
		const label = PacketType[entry.packet.type] ?? `0x${entry.packet.type.toString(16).toUpperCase()}`;
		return { label, detail: toHex(entry.packet.payload) };
	}
	return { label: "RAW", detail: toHex(entry.data) };
}

export default function RadioLinkTestScreen() {
	const { connected, setGimbalPos, beepBuzzer, firePyroChanel, log } = useRadioLink();
	const [gimbalX, setGimbalX] = useState("0");
	const [gimbalY, setGimbalY] = useState("0");
	const [channel, setChannel] = useState("1");
	const [error, setError] = useState<string | null>(null);
	const [clearedAt, setClearedAt] = useState(0);
	const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
	const logEndRef = useRef<HTMLDivElement>(null);
	const logContainerRef = useRef<HTMLDivElement>(null);
	const isAtBottomRef = useRef(true);

	const visibleLog = useMemo(() => log.filter(e => e.ts > clearedAt), [log, clearedAt]);
	const logTypes = useMemo(() => [...new Set(visibleLog.map(e => formatEntry(e).label))], [visibleLog]);
	const filteredLog = useMemo(() => visibleLog.filter(e => !hiddenTypes.has(formatEntry(e).label)), [visibleLog, hiddenTypes]);

	useEffect(() => {
		if (isAtBottomRef.current) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [filteredLog.length]);

	function handleLogScroll() {
		const el = logContainerRef.current;
		if (el) isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
	}

	async function run(action: () => Promise<void>) {
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(String(e));
		}
	}

	return (
		<div className={`flex flex-col h-full ${appBackground} text-slate-200 font-mono text-sm overflow-hidden`}>
			<div className="flex flex-1 min-h-0">
				<div className={`w-80 shrink-0 flex flex-col gap-3 overflow-y-auto p-3 border-r ${dividerBorder}`}>
					<div className={`${panelBackground} border ${panelBorder} rounded-lg p-3 flex flex-col gap-2`}>
						<span className="text-xs font-semibold text-blue-300 tracking-wide uppercase">Set Gimbal Position</span>
						<div className="flex gap-2">
							<input type="number" value={gimbalX} onChange={e => setGimbalX(e.target.value)} placeholder="X deg" disabled={!connected} className={`w-1/2 ${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-40`} />
							<input type="number" value={gimbalY} onChange={e => setGimbalY(e.target.value)} placeholder="Y deg" disabled={!connected} className={`w-1/2 ${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-40`} />
						</div>
						<button className={`${btnBlue} px-3 py-1.5 text-xs self-start`} disabled={!connected} onClick={() => run(() => setGimbalPos(Number(gimbalX), Number(gimbalY)))}>Send Gimbal</button>
					</div>
					<div className={`${panelBackground} border ${panelBorder} rounded-lg p-3 flex flex-col gap-2`}>
						<span className="text-xs font-semibold text-yellow-300 tracking-wide uppercase">Buzzer</span>
						<button className={`${btnYellow} px-3 py-1.5 text-xs self-start`} disabled={!connected} onClick={() => run(beepBuzzer)}>Beep Buzzer</button>
					</div>
					<div className={`${panelBackground} border ${panelBorder} rounded-lg p-3 flex flex-col gap-2`}>
						<span className="text-xs font-semibold text-red-300 tracking-wide uppercase">Fire Pyro Channel</span>
						<input type="number" min="0" value={channel} onChange={e => setChannel(e.target.value)} disabled={!connected} className={`${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs focus:outline-none focus:border-red-500 disabled:opacity-40`} />
						<button className={`${btnRed} px-3 py-1.5 text-xs self-start`} disabled={!connected} onClick={() => run(() => firePyroChanel(Number(channel)))}>Fire Channel</button>
					</div>
					{error && <span className="text-xs text-red-400 break-all">{error}</span>}
				</div>

				<div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
					<div className="flex items-center justify-between shrink-0">
						<span className="text-xs text-slate-600 uppercase tracking-widest">Radio Packet Log</span>
						<button className={`${btnGhost} px-2.5 py-1 text-xs`} onClick={() => setClearedAt(Date.now())}>Clear</button>
					</div>
					{logTypes.length > 0 && <div className="flex flex-wrap gap-1 shrink-0">{logTypes.map(type => {
						const hidden = hiddenTypes.has(type);
						return <button key={type} onClick={() => setHiddenTypes(prev => { const next = new Set(prev); hidden ? next.delete(type) : next.add(type); return next; })} className={`px-2 py-0.5 text-xs rounded border font-mono ${hidden ? `${mutedBorder} text-slate-600 line-through` : `${filterBackground} ${filterBorder} text-slate-300`}`}>{type}</button>;
					})}</div>}
					<div ref={logContainerRef} onScroll={handleLogScroll} className={`flex-1 min-h-0 overflow-y-auto ${logBackground} border ${panelBorder} rounded-lg p-3 flex flex-col gap-1`}>
						{filteredLog.length === 0 && <span className="text-slate-600 text-xs">{visibleLog.length === 0 ? "No packets yet." : "No packets match the filter."}</span>}
						{filteredLog.map((entry, i) => { const { label, detail } = formatEntry(entry); const isTx = entry.direction === "send"; return <div key={i} className="flex gap-2 text-xs leading-relaxed font-mono"><span className="text-slate-600 shrink-0 w-20">{new Date(entry.ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}<span className="text-slate-700">.{String(entry.ts % 1000).padStart(3, "0")}</span></span><span className={`shrink-0 w-5 font-semibold ${isTx ? "text-blue-400" : "text-green-400"}`}>{isTx ? "↑" : "↓"}</span><span className={`shrink-0 font-semibold min-w-[11rem] ${isTx ? "text-blue-300" : "text-green-300"}`}>{label}</span>{detail && <span className="break-all text-slate-400">{detail}</span>}</div>; })}
						<div ref={logEndRef} />
					</div>
				</div>
			</div>
		</div>
	);
}
