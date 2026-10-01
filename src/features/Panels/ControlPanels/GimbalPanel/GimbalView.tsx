import { useRef } from "react";

export interface GimbalAngles {
    degX_deg: number;
    degY_deg: number;
}

interface GimbalViewProps {
    /** Commanded (preview) angles — the red cylinder follows this. */
    commanded: GimbalAngles;
    /** Actual rocket-reported angles — shown as a ghost marker. Null when unknown. */
    actual: GimbalAngles | null;
    /** Max deflection from center in degrees. Pointer maps edge -> max. */
    maxDeflectionDeg?: number;
    disabled?: boolean;
    /** Fired on every pointer move while dragging (already clamped). */
    onDrag: (angles: GimbalAngles) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    className?: string;
}

export const GIMBAL_VIEW_SIZE = 200;
const CENTER = GIMBAL_VIEW_SIZE / 2;
// Nozzle travel when fully deflected (px from center in the drawing).
const NOZZLE_TRAVEL = 62;
const LIMIT_RING_R = NOZZLE_TRAVEL + 14;

export function clampAngles(degX: number, degY: number, max: number): GimbalAngles {
    // Clamp each axis, then clamp the vector magnitude so corners stay in range.
    const cx = Math.max(-max, Math.min(max, degX));
    const cy = Math.max(-max, Math.min(max, degY));
    const mag = Math.hypot(cx, cy);
    if (mag <= max || mag === 0) return { degX_deg: cx, degY_deg: cy };
    const s = max / mag;
    return { degX_deg: cx * s, degY_deg: cy * s };
}

export function anglesToOffset(a: GimbalAngles, max: number): { x: number; y: number } {
    return {
        x: (a.degX_deg / max) * NOZZLE_TRAVEL,
        y: (a.degY_deg / max) * NOZZLE_TRAVEL,
    };
}

/**
 * Bottom-view placeholder of the motor gimbal on a polar grid.
 *
 * Looking up at the rocket from below: +X tilts the nozzle toward screen-right,
 * +Y tilts it toward screen-down (drag down => nozzle follows the mouse).
 */
export function GimbalView({
    commanded,
    actual,
    maxDeflectionDeg = 10,
    disabled = false,
    onDrag,
    onDragStart,
    onDragEnd,
    className = "",
}: GimbalViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const draggingRef = useRef(false);
    // True when the current focus came from a pointer press, so no focus ring
    // is drawn for clicks while Tab-navigation still gets a hint.
    const pointerFocusRef = useRef(false);

    const pointToAngles = (clientX: number, clientY: number): GimbalAngles | null => {
        const svg = svgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        // The viewBox is square and preserveAspectRatio defaults to
        // "xMidYMid meet", so a non-square element box letterboxes the
        // drawing. Map through that content box (not the raw rect) or the
        // handle lands off-center from the cursor.
        const scale = Math.min(rect.width, rect.height) / GIMBAL_VIEW_SIZE;
        const offsetX = (rect.width - GIMBAL_VIEW_SIZE * scale) / 2;
        const offsetY = (rect.height - GIMBAL_VIEW_SIZE * scale) / 2;

        const x = (clientX - rect.left - offsetX) / scale - CENTER;
        const y = (clientY - rect.top - offsetY) / scale - CENTER;
        const degX = (x / NOZZLE_TRAVEL) * maxDeflectionDeg;
        const degY = (y / NOZZLE_TRAVEL) * maxDeflectionDeg;
        return clampAngles(degX, degY, maxDeflectionDeg);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        // Clicking must not paint a focus ring.
        pointerFocusRef.current = true;
        draggingRef.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        onDragStart?.();
        const a = pointToAngles(e.clientX, e.clientY);
        if (a) onDrag(a);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current || disabled) return;
        const a = pointToAngles(e.clientX, e.clientY);
        if (a) onDrag(a);
    };

    const endDrag = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        onDragEnd?.();
    };

    const cmd = anglesToOffset(commanded, maxDeflectionDeg);
    const clampedActual = actual ? clampAngles(actual.degX_deg, actual.degY_deg, maxDeflectionDeg) : null;
    const act = clampedActual ? anglesToOffset(clampedActual, maxDeflectionDeg) : null;
    // Hide the ghost when it sits exactly on the target (epsilon for float noise).
    const coincides =
        act !== null &&
        Math.abs(act.x - cmd.x) < 0.5 &&
        Math.abs(act.y - cmd.y) < 0.5;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${GIMBAL_VIEW_SIZE} ${GIMBAL_VIEW_SIZE}`}
            preserveAspectRatio="xMidYMid meet"
            role="slider"
            aria-label="Gimbal position"
            aria-valuemin={-maxDeflectionDeg}
            aria-valuemax={maxDeflectionDeg}
            aria-valuetext={`X ${commanded.degX_deg.toFixed(1)} deg, Y ${commanded.degY_deg.toFixed(1)} deg`}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (disabled) return;
                const step = e.shiftKey ? 1 : 0.5;
                let x = commanded.degX_deg;
                let y = commanded.degY_deg;
                if (e.key === "ArrowLeft") x -= step;
                else if (e.key === "ArrowRight") x += step;
                else if (e.key === "ArrowUp") y -= step;
                else if (e.key === "ArrowDown") y += step;
                else if (e.key === "Home") { x = 0; y = 0; }
                else return;
                e.preventDefault();
                onDragStart?.();
                onDrag(clampAngles(x, y, maxDeflectionDeg));
                onDragEnd?.();
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`w-full select-none outline-none ${disabled ? "opacity-50" : ""} ${className}`}
            style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
        >
            {/* Polar grid: concentric range rings + radial spokes every 30 deg */}
            {[0.5, 1].map((f) => (
                <circle
                    key={f}
                    cx={CENTER}
                    cy={CENTER}
                    r={NOZZLE_TRAVEL * f}
                    fill="none"
                    stroke="#3f3f46"
                    strokeWidth={1}
                />
            ))}
            <circle cx={CENTER} cy={CENTER} r={LIMIT_RING_R} fill="none" stroke="#52525b" strokeWidth={1} strokeDasharray="5 4" />
            {Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6).map((a) => (
                <line
                    key={a}
                    x1={CENTER}
                    y1={CENTER}
                    x2={CENTER + Math.cos(a) * LIMIT_RING_R}
                    y2={CENTER + Math.sin(a) * LIMIT_RING_R}
                    stroke="#27272a"
                    strokeWidth={1}
                />
            ))}

            <text x={CENTER + LIMIT_RING_R + 2} y={CENTER + 3} fontSize={8} fill="#71717a">+X</text>
            <text x={CENTER - LIMIT_RING_R - 12} y={CENTER + 3} fontSize={8} fill="#71717a">-X</text>
            <text x={CENTER + 3} y={CENTER + LIMIT_RING_R + 10} fontSize={8} fill="#71717a">+Y</text>
            <text x={CENTER + 3} y={CENTER - LIMIT_RING_R - 4} fontSize={8} fill="#71717a">-Y</text>

            {/* Ghost handle: same shape as the target, translucent.
                Hidden when it coincides with the target so they don't stack. */}
            {act && !coincides && (
                <g opacity={0.35}>
                    <line
                        x1={CENTER}
                        y1={CENTER}
                        x2={CENTER + act.x}
                        y2={CENTER + act.y}
                        stroke="#71717a"
                        strokeWidth={2}
                        strokeLinecap="round"
                    />
                    <circle cx={CENTER + act.x} cy={CENTER + act.y} r={10} fill="#dc2626" stroke="#7f1d1d" strokeWidth={2} />
                </g>
            )}

            {/* Target handle: thin arm + flat red nozzle dot. User-owned only. */}
            <line
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + cmd.x}
                y2={CENTER + cmd.y}
                stroke="#71717a"
                strokeWidth={2}
                strokeLinecap="round"
            />
            {/* Center pivot */}
            <circle cx={CENTER} cy={CENTER} r={3} fill="#a1a1aa" />

            {/* Target nozzle dot */}
            <circle cx={CENTER + cmd.x} cy={CENTER + cmd.y} r={10} fill="#dc2626" stroke="#7f1d1d" strokeWidth={2} />
        </svg>
    );
}
