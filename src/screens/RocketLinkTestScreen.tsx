import { useState } from "react";
import { useRocketLink } from "../features/RocketLink/RocketLinkContext";
import { PacketType } from "../features/RocketLink/Protocol";
import {
    appBackground,
    outerCard,
    btnBlue,
    btnYellow,
    inputBackground,
    inputBorder,
    innerCard,
} from "../shared/styles";
import PacketLog from "../shared/components/PacketLog";

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
    const { connected, sendRadio, sendAT, log } = useRocketLink();

    const [radioInput, setRadioInput] = useState("DE AD BE EF");
    const [radioError, setRadioError] = useState<string | null>(null);

    const [atCommand, setAtCommand] = useState("AT+VER");
    const [atError, setAtError] = useState<string | null>(null);

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

    async function handleSendAT() {
        setAtError(null);
        try {
            await sendAT(atCommand);
        } catch (e) {
            setAtError(String(e));
        }
    }

    return (
        <div className={`flex flex-col h-full ${appBackground} text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3`}>
            {/* Body: controls on left, log on right */}
            <div className="flex flex-1 min-h-0 gap-3">

                {/* Left: action cards */}
                <div className={`${outerCard} w-80 shrink-0 flex flex-col gap-3 overflow-y-auto p-3`}>

                    {/* Send Radio */}
                    <div className={`${innerCard} p-3 flex flex-col gap-2`}>
                        <span className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">Send Radio</span>
                        <input
                            type="text"
                            value={radioInput}
                            onChange={e => { setRadioInput(e.target.value); setRadioError(null); }}
                            onKeyDown={e => e.key === "Enter" && handleSendRadio()}
                            placeholder="hex bytes  e.g.  DE AD BE EF"
                            disabled={!connected}
                            className={`${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-40`}
                        />
                        <button className={`${btnBlue} px-3 py-1.5 text-xs self-start`} onClick={handleSendRadio} disabled={!connected}>
                            Send Radio
                        </button>
                        {radioError  && <span className="text-xs text-red-400 break-all">{radioError}</span>}
                    </div>

                    {/* Send AT Command */}
                    <div className={`${innerCard} p-3 flex flex-col gap-2`}>
                        <span className="text-xs font-semibold text-yellow-300 tracking-wide uppercase">AT Command</span>
                        <input
                            type="text"
                            value={atCommand}
                            onChange={e => { setAtCommand(e.target.value); setAtError(null); }}
                            onKeyDown={e => e.key === "Enter" && handleSendAT()}
                            placeholder="e.g.  AT+VER"
                            disabled={!connected}
                            className={`${inputBackground} border ${inputBorder} rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-40`}
                        />
                        <button className={`${btnYellow} px-3 py-1.5 text-xs self-start`} onClick={handleSendAT} disabled={!connected}>
                            Send AT
                        </button>
                        {atError && <span className="text-xs text-red-400 break-all">{atError}</span>}
                    </div>
                </div>

                {/* Right: log */}
                <PacketLog title="Packet Log" log={log} formatEntry={formatEntry} />

            </div>
        </div>
    );
}
