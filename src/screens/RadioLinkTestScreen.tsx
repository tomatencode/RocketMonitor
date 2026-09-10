import { useState } from "react";
import { PacketType } from "../features/RadioLink/Protocol";
import { useRadioLink } from "../features/RadioLink/RadioLinkContext";
import {
	appBackground,
	outerCard,
	btnBlue,
	btnRed,
	btnYellow,
	inputBackground,
	inputBorder,
	innerCard,
	radius,
} from "../shared/styles";
import PacketLog from "../shared/components/PacketLog";

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

	async function run(action: () => Promise<void>) {
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(String(e));
		}
	}

	return (
		<div className={`flex flex-col h-full ${appBackground} text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3`}>
			<div className="flex flex-1 min-h-0 gap-3">
				<div className={`${outerCard} w-80 shrink-0 flex flex-col gap-3 overflow-y-auto p-3`}>
					<div className={`${innerCard} p-3 flex flex-col gap-2`}>
						<span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">Set Gimbal Position</span>
						<div className="flex gap-2">
							<input type="number" value={gimbalX} onChange={e => setGimbalX(e.target.value)} placeholder="X deg" disabled={!connected} className={`w-1/2 ${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs focus:outline-none focus:border-zinc-500 disabled:opacity-40`} />
							<input type="number" value={gimbalY} onChange={e => setGimbalY(e.target.value)} placeholder="Y deg" disabled={!connected} className={`w-1/2 ${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs focus:outline-none focus:border-zinc-500 disabled:opacity-40`} />
						</div>
						<button className={`${btnBlue} px-3 py-1.5 text-xs self-start`} disabled={!connected} onClick={() => run(() => setGimbalPos(Number(gimbalX), Number(gimbalY)))}>Send Gimbal</button>
					</div>
					<div className={`${innerCard} p-3 flex flex-col gap-2`}>
						<span className="text-xs font-semibold text-yellow-300 tracking-wide uppercase">Buzzer</span>
						<button className={`${btnYellow} px-3 py-1.5 text-xs self-start`} disabled={!connected} onClick={() => run(beepBuzzer)}>Beep Buzzer</button>
					</div>
					<div className={`${innerCard} p-3 flex flex-col gap-2`}>
						<span className="text-xs font-semibold text-red-300 tracking-wide uppercase">Fire Pyro Channel</span>
						<input type="number" min="0" value={channel} onChange={e => setChannel(e.target.value)} disabled={!connected} className={`${inputBackground} border ${inputBorder} ${radius} px-2 py-1.5 text-xs focus:outline-none focus:border-red-500 disabled:opacity-40`} />
						<button className={`${btnRed} px-3 py-1.5 text-xs self-start`} disabled={!connected} onClick={() => run(() => firePyroChanel(Number(channel)))}>Fire Channel</button>
					</div>
					{error && <span className="text-xs text-red-400 break-all">{error}</span>}
				</div>

				<PacketLog title="Radio Packet Log" log={log} formatEntry={formatEntry} />
			</div>
		</div>
	);
}
