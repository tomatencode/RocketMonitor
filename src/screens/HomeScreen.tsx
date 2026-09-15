import { useState } from "react";
import { useRadioLink } from "../features/RadioLink/RadioLinkContext";
import { useRocketLink } from "../features/RocketLink/RocketLinkContext";
import {
	appBackground,
} from "../shared/styles";
import { Button } from "../shared/components/primitives/Button";
import { Card } from "../shared/components/primitives/Card";
import { Input } from "../shared/components/primitives/Input";

function parseHex(input: string): number[] | null {
	const tokens = input.trim().split(/\s+/);
	if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === "")) return [];
	const bytes = tokens.map(token => parseInt(token, 16));
	return bytes.some(byte => isNaN(byte) || byte < 0 || byte > 255) ? null : bytes;
}

export default function HomeScreen() {
	const { connected, setGimbalPos, beepBuzzer, firePyroChanel } = useRadioLink();
	const { connected: usbConnected, sendRadio, sendAT } = useRocketLink();
	const [gimbalX, setGimbalX] = useState("0");
	const [gimbalY, setGimbalY] = useState("0");
	const [channel, setChannel] = useState("1");
	const [error, setError] = useState<string | null>(null);
	const [radioInput, setRadioInput] = useState("DE AD BE EF");
	const [atCommand, setAtCommand] = useState("AT+VER");
	const [rocketError, setRocketError] = useState<string | null>(null);

	async function run(action: () => Promise<void>) {
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(String(e));
		}
	}

	async function handleSendRadio() {
		setRocketError(null);
		const bytes = parseHex(radioInput);
		if (bytes === null) { setRocketError("Invalid hex bytes"); return; }
		try { await sendRadio(bytes); } catch (e) { setRocketError(String(e)); }
	}

	async function handleSendAT() {
		setRocketError(null);
		try { await sendAT(atCommand); } catch (e) { setRocketError(String(e)); }
	}

	return (
		<div className={`flex flex-col h-full ${appBackground} text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3`}>
			<div className="flex flex-row min-h-0 gap-3 overflow-x-auto">
				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
					<span className={`text-xs font-semibold tracking-wide uppercase ${usbConnected ? "text-zinc-300" : "text-zinc-600"}`}>Rocket-Link Commands</span>
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${usbConnected ? "text-zinc-300" : "text-zinc-600"}`}>Send Radio</span>
						<Input type="text" value={radioInput} onChange={e => setRadioInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendRadio()} disabled={!usbConnected} />
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!usbConnected} onClick={handleSendRadio}>Send Radio</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${usbConnected ? "text-yellow-300" : "text-yellow-300/40"}`}>AT Command</span>
						<Input type="text" value={atCommand} onChange={e => setAtCommand(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendAT()} disabled={!usbConnected} />
						<Button variant="warning" className="px-3 py-1.5 text-xs self-start" disabled={!usbConnected} onClick={handleSendAT}>Send AT</Button>
					</Card>
				</div>
				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
					<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Radio-Link Commands</span>
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Set Gimbal Position</span>
						<div className="flex gap-2">
							<Input type="number" value={gimbalX} onChange={e => setGimbalX(e.target.value)} placeholder="X deg" disabled={!connected} className="w-1/2" />
							<Input type="number" value={gimbalY} onChange={e => setGimbalY(e.target.value)} placeholder="Y deg" disabled={!connected} className="w-1/2" />
						</div>
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => setGimbalPos(Number(gimbalX), Number(gimbalY)))}>Send Gimbal</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-yellow-300" : "text-yellow-300/40"}`}>Buzzer</span>
						<Button variant="warning" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(beepBuzzer)}>Beep Buzzer</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-red-300" : "text-red-300/40"}`}>Fire Pyro Channel</span>
						<Input type="number" min="0" value={channel} onChange={e => setChannel(e.target.value)} disabled={!connected} />
						<Button variant="danger" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => firePyroChanel(Number(channel)))}>Fire Channel</Button>
					</Card>
					{error &&
					<Card variant="error" className="p-3 flex flex-col gap-2">
						<span className="text-xs text-red-400 break-all">{error}</span>
					</Card>
					}
					{rocketError &&
					<Card variant="error" className="p-3 flex flex-col gap-2">
						<span className="text-xs text-red-400 break-all">{rocketError}</span>
					</Card>
					}
				</div>
			</div>
		</div>
	);
}
