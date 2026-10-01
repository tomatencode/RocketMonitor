import { useRef, useState } from "react";
import { useRadioLink } from "../../RadioLink/RadioLinkContext";
import { Button } from "../../../shared/components/primitives/Button";
import { Card } from "../../../shared/components/elements/Card";
import { Input } from "../../../shared/components/primitives/Input";
import { StatusPill } from "../../../shared/components/elements/StatusPill";
import { StatusTile } from "../../../shared/components/elements/StatusTile";
import { PanelHeader } from "../../../shared/components/elements/PanelHeader";
import { StatusDot } from "../../../shared/components/elements/StatusDot";
import { GimbalView, clampAngles, type GimbalAngles } from "./GimbalView";
import { useGimbalStatus } from "./useGimbalStatus";

export interface GimbalPanelProps {
    maxDeflectionDeg?: number;
    pollIntervalMs?: number;
    /** Min ms between SET_GIMBAL sends while dragging. Defaults to 150. */
    sendThrottleMs?: number;
    className?: string;
}

function fmt(v: number | null, digits = 1): string {
    return v === null ? "--" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

export function GimbalPanel({
    maxDeflectionDeg = 10,
    pollIntervalMs = 1500,
    sendThrottleMs = 150,
    className = "",
}: GimbalPanelProps) {
    const { connected, setGimbalPos } = useRadioLink();
    const { degX_deg: actualX, degY_deg: actualY, error: pollError, refresh } = useGimbalStatus({
        pollIntervalMs,
        enabled: connected,
    });

    // Commanded (target) position. Only ever moved by the user — never synced
    // from the rocket. The ghost handle shows the actual position instead.
    const [commanded, setCommanded] = useState<GimbalAngles>({ degX_deg: 0, degY_deg: 0 });
    const [inputX, setInputX] = useState("0.0");
    const [inputY, setInputY] = useState("0.0");
    const [dragging, setDragging] = useState(false);
    const [sending, setSending] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [lastSentAt, setLastSentAt] = useState<number | null>(null);

    const actual: GimbalAngles | null = actualX !== null && actualY !== null
        ? { degX_deg: actualX, degY_deg: actualY }
        : null;

    // Latest-wins sender: only one SET_GIMBAL is in flight at a time, and if
    // more drag moves arrive while it is, only the newest is kept. Chaining
    // every move (the previous approach) made the queue grow without bound
    // during a drag, so the gimbal fell seconds behind the handle.
    const inFlightRef = useRef(false);
    const pendingRef = useRef<GimbalAngles | null>(null);
    const lastSendRef = useRef(0);
    const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushSendQueue = () => {
        if (inFlightRef.current || !pendingRef.current || !connected) return;
        const next = pendingRef.current;
        pendingRef.current = null;
        inFlightRef.current = true;
        lastSendRef.current = Date.now();
        setSending(true);
        setActionError(null);
        Promise.resolve()
            .then(() => setGimbalPos(next.degX_deg, next.degY_deg))
            .then(() => setLastSentAt(Date.now()))
            .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
            .finally(() => {
                inFlightRef.current = false;
                if (pendingRef.current) {
                    // Coalesce immediate follow-ups into the next microtask.
                    Promise.resolve().then(flushSendQueue);
                } else {
                    setSending(false);
                }
            });
    };

    const sendAngles = (a: GimbalAngles, opts?: { force?: boolean }) => {
        if (!connected) return;
        // Always keep the newest value; `force` (drag end / button) bypasses
        // the throttle so the final position is never dropped.
        pendingRef.current = a;
        if (!opts?.force && Date.now() - lastSendRef.current < sendThrottleMs) {
            // Trailing send: a throttled move would otherwise sit pending
            // forever if the pointer stops moving inside the window.
            if (trailingTimerRef.current === null) {
                const wait = Math.max(0, sendThrottleMs - (Date.now() - lastSendRef.current));
                trailingTimerRef.current = setTimeout(() => {
                    trailingTimerRef.current = null;
                    flushSendQueue();
                }, wait);
            }
            return;
        }
        if (trailingTimerRef.current !== null) {
            clearTimeout(trailingTimerRef.current);
            trailingTimerRef.current = null;
        }
        flushSendQueue();
    };

    const handleDrag = (a: GimbalAngles) => {
        setCommanded(a);
        setInputX(a.degX_deg.toFixed(1));
        setInputY(a.degY_deg.toFixed(1));
        sendAngles(a);
    };

    const handleDragStart = () => {
        setDragging(true);
    };

    const handleDragEnd = () => {
        setDragging(false);
        // Trailing send guarantees the release position lands on the rocket
        // even if intermediate moves were throttled away.
        sendAngles(commanded, { force: true });
        refresh();
    };

    const applyInputs = () => {
        const x = Number.parseFloat(inputX);
        const y = Number.parseFloat(inputY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const a = clampAngles(x, y, maxDeflectionDeg);
        setCommanded(a);
        setInputX(a.degX_deg.toFixed(1));
        setInputY(a.degY_deg.toFixed(1));
        sendAngles(a, { force: true });
        refresh();
    };

    const handleCenter = () => {
        const a: GimbalAngles = { degX_deg: 0, degY_deg: 0 };
        setCommanded(a);
        setInputX("0.0");
        setInputY("0.0");
        sendAngles(a, { force: true });
        refresh();
    };
    const statusError = actionError ?? pollError;

    return (
        <Card className={`flex flex-col gap-3 p-3 overflow-hidden relative ${className}`}>
            <PanelHeader
                icon="◉"
                title="Gimbal"
                subtitle={`±${maxDeflectionDeg} deg`}
                connected={connected}
                end={
                    <StatusPill tone={!connected ? "neutral" : dragging || sending ? "info" : actual ? "ok" : "warn"} pulse={dragging || sending}>
                        {!connected ? "Offline" : dragging ? "Dragging" : sending ? "Sending" : actual ? "Synced" : "No data"}
                    </StatusPill>
                }
            />
            <GimbalView
                commanded={commanded}
                actual={actual}
                maxDeflectionDeg={maxDeflectionDeg}
                disabled={!connected}
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            />
            <div className="grid grid-cols-2 gap-2">
                <StatusTile
                    label="Commanded X"
                    value={connected ? `${fmt(commanded.degX_deg)} deg` : "NO LINK"}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} pulse={dragging} />}
                    tone={connected ? "info" : "neutral"}
                    title="Position being commanded (drag the graphic or type below)"
                />
                <StatusTile
                    label="Commanded Y"
                    value={connected ? `${fmt(commanded.degY_deg)} deg` : "NO LINK"}
                    icon={<StatusDot tone={connected ? "info" : "neutral"} pulse={dragging} />}
                    tone={connected ? "info" : "neutral"}
                    title="Position being commanded (drag the graphic or type below)"
                />
            </div>
            <div className="flex">
                <Button variant="primary" className="px-3 py-1.5 text-xs w-full" disabled={!connected} onClick={handleCenter} title="Return gimbal to center (0, 0)">
                    Center
                </Button>
            </div>

            {statusError && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{statusError}</span>
                </div>
            )}
        </Card>
    );
}

export default GimbalPanel;

