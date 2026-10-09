import { useRef, useState } from "react";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketConnected } from "../../../RocketStatus/RocketStatusContext";
import { Button } from "../../../../shared/components/primitives/Button";
import { Card } from "../../../../shared/components/elements/Card";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { StatusTile } from "../../../../shared/components/elements/StatusTile";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { StatusDot } from "../../../../shared/components/elements/StatusDot";
import { GimbalView, type GimbalAngles } from "./GimbalView";
import { useGimbalStatus } from "./useGimbalStatus";

export interface GimbalPanelProps {
    maxDeflectionDeg?: number;
    className?: string;
}

function fmt(v: number | null, digits = 1): string {
    return v === null ? "--" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

export function GimbalPanel({
    maxDeflectionDeg = 10,
    className = "",
}: GimbalPanelProps) {
    const connected = useRocketConnected();
    const { setGimbalPos } = useRocketCommander();
    const { degX_deg: actualX, degY_deg: actualY, error: pollError } = useGimbalStatus();

    // Commanded (target) position. Only ever moved by the user — never synced
    // from the rocket. The ghost handle shows the actual position instead.
    const [commanded, setCommanded] = useState<GimbalAngles>({ degX_deg: 0, degY_deg: 0 });
    const [dragging, setDragging] = useState(false);
    const [sending, setSending] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const actual: GimbalAngles | null = actualX !== null && actualY !== null
        ? { degX_deg: actualX, degY_deg: actualY }
        : null;

    // Latest-wins sender: one SET_GIMBAL in flight at a time. Angles that
    // arrive mid-flight replace any value still waiting, so the gimbal tracks
    // the handle as fast as the link allows without ever queueing a backlog.
    const inFlightRef = useRef(false);
    const pendingRef = useRef<GimbalAngles | null>(null);

    const flush = () => {
        if (inFlightRef.current || !pendingRef.current || !connected) return;
        const next = pendingRef.current;
        pendingRef.current = null;
        inFlightRef.current = true;
        setSending(true);
        setActionError(null);
        setGimbalPos(next.degX_deg, next.degY_deg)
            .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
            .finally(() => {
                inFlightRef.current = false;
                if (pendingRef.current) {
                    // A newer position is already waiting: send it immediately.
                    flush();
                } else {
                    setSending(false);
                }
            });
    };

    const sendAngles = (a: GimbalAngles) => {
        if (!connected) return;
        pendingRef.current = a;
        flush();
    };

    const handleDrag = (a: GimbalAngles) => {
        setCommanded(a);
        sendAngles(a);
    };

    const handleDragStart = () => {
        setDragging(true);
    };

    const handleDragEnd = () => {
        setDragging(false);
        // Sends the release position straight away (or as soon as any in-flight
        // send settles), so the final handle position is never dropped.
        sendAngles(commanded);
    };
    const handleCenter = () => {
        const a: GimbalAngles = { degX_deg: 0, degY_deg: 0 };
        setCommanded(a);
        sendAngles(a);
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
                <Button variant="ghost" className="px-3 py-1.5 text-xs w-full" disabled={!connected} onClick={handleCenter} title="Return gimbal to center (0, 0)">
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

