import { useState } from "react";
import { JobStatus, MessageType } from "../features/RadioLink/Protocol";
import { useRadioLink } from "../features/RadioLink/RadioLinkContext";
import {
	appBackground,
} from "../shared/styles";
import PacketLog, { FormattedEntry } from "../features/RadioLink/components/PacketLog";
import { Button } from "../shared/components/primitives/Button";
import { Card } from "../shared/components/primitives/Card";
import { Input } from "../shared/components/primitives/Input";

type LogEntry = ReturnType<typeof useRadioLink>["log"][number];

function toHex(bytes: ArrayLike<number>) {
	return Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function statusBadge(status: JobStatus): { text: string; className: string } {
	switch (status) {
		case JobStatus.SUCCESS: return { text: "OK", className: "text-green-300 border-green-700/50" };
		case JobStatus.FAILURE: return { text: "FAIL", className: "text-red-300 border-red-700/50" };
		default: return { text: "BUSY", className: "text-yellow-300 border-yellow-700/50" };
	}
}

function formatEntry(entry: LogEntry): FormattedEntry {
	const label = MessageType[entry.message.type] ?? `0x${entry.message.type.toString(16).toUpperCase()}`;
	return {
		label,
		detail: toHex(entry.message.payload),
		seqId: entry.message.seqId,
		status: entry.direction === "receive" ? statusBadge(entry.message.status) : undefined,
	};
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
		<div className={`flex flex-col h-full ${appBackground} text-zinc-200 font-mono text-sm overflow-hidden px-3 pb-3 gap-3`}>
			<div className="flex flex-1 min-h-0 gap-3">
				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
					<Card className="p-3 flex flex-col gap-2">
						<span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">Set Gimbal Position</span>
						<div className="flex gap-2">
							<Input type="number" value={gimbalX} onChange={e => setGimbalX(e.target.value)} placeholder="X deg" disabled={!connected} className="w-1/2" />
							<Input type="number" value={gimbalY} onChange={e => setGimbalY(e.target.value)} placeholder="Y deg" disabled={!connected} className="w-1/2" />
						</div>
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => setGimbalPos(Number(gimbalX), Number(gimbalY)))}>Send Gimbal</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2">
						<span className="text-xs font-semibold text-yellow-300 tracking-wide uppercase">Buzzer</span>
						<Button variant="warning" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(beepBuzzer)}>Beep Buzzer</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2">
						<span className="text-xs font-semibold text-red-300 tracking-wide uppercase">Fire Pyro Channel</span>
						<Input type="number" min="0" value={channel} onChange={e => setChannel(e.target.value)} disabled={!connected} />
						<Button variant="danger" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => firePyroChanel(Number(channel)))}>Fire Channel</Button>
					</Card>
					{error &&
					<Card variant="error" className="p-3 flex flex-col gap-2">
						<span className="text-xs text-red-400 break-all">{error}</span>
					</Card>
					}
				</div>

				<PacketLog title="Radio Packet Log" log={log} formatEntry={formatEntry} />
			</div>
		</div>
	);
}
