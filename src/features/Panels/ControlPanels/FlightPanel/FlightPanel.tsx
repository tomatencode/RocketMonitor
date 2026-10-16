import { useEffect, useRef, useState } from "react";
import { Card } from "../../../../shared/components/elements/Card";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { RocketIcon } from "../../../../shared/components/elements/Icons";
import { Button } from "../../../../shared/components/primitives/Button";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketConnected } from "../../../RocketStatus/RocketStatusContext";
import { useRocketStatus, useRocketStatusStore } from "../../../RocketStatus/RocketStatusContext";
import type { FlightProfile } from "../../../RocketStatus/rocketTypes";
import { FlightState } from "../../../RocketStatus/rocketTypes";
import { FlightProfileForm } from "./FlightProfileForm";
import { FlightSummary } from "./FlightSummary";
import { FlightTelemetry } from "./FlightTelemetry";
import { returnToFlightSetup } from "./returnToFlightSetup";
import { isAirborneFlight, updateFlightClock } from "./flightClock";

const STATE_LABELS: Record<FlightState, string> = {
    [FlightState.IDLE]: "Idle",
    [FlightState.COUNTDOWN]: "Countdown",
    [FlightState.BURNING]: "Burning",
    [FlightState.COASTING]: "Coasting",
    [FlightState.DESCENDING]: "Descending",
    [FlightState.LANDED]: "Landed",
    [FlightState.ABORTED]: "Aborted",
};

const isActiveFlight = (state: FlightState) => state >= FlightState.COUNTDOWN && state <= FlightState.DESCENDING;
const isCompleteFlight = (state: FlightState) => state === FlightState.LANDED || state === FlightState.ABORTED;

export function FlightPanel() {
    const connected = useRocketConnected();
    const store = useRocketStatusStore();
    const [flightLog, setFlightLog] = useState<{ name: string; session: number } | null>(null);
    const [retainedSummary, setRetainedSummary] = useState<FlightState | null>(null);
    const idleAcknowledgedSession = useRef<number | null>(null);
    const { startCountdown, abortFlight, retryDeployParachute, endFlight } = useRocketCommander();
    const { value: state, error: stateError } = useRocketStatus("flightState");
    const { value: location, error: locationError } = useRocketStatus("flightLocation");
    const { value: countdownTime } = useRocketStatus("countdownTime");
    const [launching, setLaunching] = useState(false);
    const [acting, setActing] = useState<"abort" | "deploy" | "idle" | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedMs, setElapsedMs] = useState<number | null>(null);
    const [maxAltitude_m, setMaxAltitude] = useState<number | null>(null);
    const [maxVelocity_m_s, setMaxVelocity] = useState<number | null>(null);
    const previousState = useRef<FlightState | null>(null);

    useEffect(() => {
        if (state === null) return;
        const previous = previousState.current;
        previousState.current = state;

        if (state === FlightState.IDLE && previous !== FlightState.IDLE) {
            if (retainedSummary !== null) return;
            setFlightLog(null);
            setStartedAt(null);
            setElapsedMs(null);
            setMaxAltitude(null);
            setMaxVelocity(null);
            return;
        }
        if (isActiveFlight(state) && !isActiveFlight(previous ?? FlightState.IDLE)) {
            setMaxAltitude(location?.height_m ?? null);
            setMaxVelocity(null);
        }
        if (state !== previous) {
            const clock = updateFlightClock(state, startedAt, elapsedMs, Date.now());
            setStartedAt(clock.startedAt);
            setElapsedMs(clock.elapsedMs);
        }
    }, [state, location?.height_m, startedAt, elapsedMs, retainedSummary]);

    useEffect(() => {
        if (!connected || (state !== null && isActiveFlight(state))) {
            setRetainedSummary(null);
            idleAcknowledgedSession.current = null;
        }
    }, [connected, state]);

    useEffect(() => {
        if (startedAt === null || state === null || !isAirborneFlight(state)) return;
        const updateElapsed = () => setElapsedMs(Date.now() - startedAt);
        updateElapsed();
        const intervalId = setInterval(updateElapsed, 100);
        return () => clearInterval(intervalId);
    }, [startedAt, state]);

    useEffect(() => {
        if (location === null || state === null || (!isActiveFlight(state) && !isCompleteFlight(state))) return;
        setMaxAltitude((current) => current === null ? location.height_m : Math.max(current, location.height_m));
    }, [location, state]);

    useEffect(() => {
        if (location === null || state === null || !isAirborneFlight(state)) return;
        setMaxVelocity((current) => current === null ? location.verticalVelocity_m_s : Math.max(current, location.verticalVelocity_m_s));
    }, [location, state]);

    const runAction = async (action: "abort" | "deploy" | "idle", command: () => Promise<void>) => {
        setActionError(null);
        setActing(action);
        try {
            await command();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error));
        } finally {
            setActing(null);
        }
    };

    const handleLaunch = async (profile: FlightProfile) => {
        setActionError(null);
        setLaunching(true);
        const session = store.getSession();
        idleAcknowledgedSession.current = null;
        try {
            await startCountdown(profile);
            if (session === store.getSession()) setFlightLog({ name: profile.flightName, session });
        } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error));
        } finally {
            setLaunching(false);
        }
    };

    const label = state === null ? "Waiting" : STATE_LABELS[state] ?? "Unknown";
    const alert = state !== null && state !== FlightState.IDLE;
    const inFlight = state !== null && isActiveFlight(state);
    const complete = state !== null && isCompleteFlight(state);

    return (
        <Card className="relative flex min-w-0 flex-col gap-3 overflow-hidden p-3 " variant={state === FlightState.ABORTED ? "error" : "outer"}>
            <PanelHeader
                icon={<RocketIcon aria-hidden="true" />}
                title="Flight Control"
                subtitle={connected ? "radio telemetry" : "radio link offline"}
                alert={alert}
                connected={connected}
                className="border-b border-zinc-800/80 pb-3"
                end={<StatusPill tone={!connected ? "neutral" : state === FlightState.ABORTED ? "danger" : inFlight ? "warn" : complete ? "ok" : "neutral"} pulse={connected && inFlight}>{connected ? label : "Offline"}</StatusPill>}
            />
            {state === FlightState.IDLE && retainedSummary === null && <FlightProfileForm connected={connected} launching={launching} onLaunch={handleLaunch} />}
            {inFlight && (
                <>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Flight telemetry</span>
                        <span className="font-mono text-[10px] text-zinc-500">{connected ? "LIVE" : "LINK OFFLINE"}</span>
                    </div>
                    <FlightTelemetry location={location} maxAltitude_m={maxAltitude_m} maxVelocity_m_s={maxVelocity_m_s} elapsedMs={elapsedMs} countdownTime_ms={state === FlightState.COUNTDOWN ? countdownTime : null} countingDown={state === FlightState.COUNTDOWN} />
                    <Card variant="inner" className="flex flex-col gap-2 p-3">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Flight overrides</span>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="danger" className="px-3 py-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400" disabled={!connected || acting !== null} onClick={() => void runAction("abort", abortFlight)}>
                                {acting === "abort" ? "Aborting..." : "Abort Flight"}
                            </Button>
                            <Button variant="warning" className="px-3 py-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400" disabled={!connected || acting !== null} onClick={() => void runAction("deploy", retryDeployParachute)}>
                                {acting === "deploy" ? "Deploying..." : "Retry Deploy"}
                            </Button>
                        </div>
                    </Card>
                </>
            )}
            {(complete || retainedSummary !== null) && <FlightSummary state={retainedSummary ?? state!} flightName={flightLog?.session === store.getSession() ? flightLog.name : null} location={location} maxAltitude_m={maxAltitude_m} maxVelocity_m_s={maxVelocity_m_s} elapsedMs={elapsedMs} ending={acting === "idle"}
                onPrepareIdleDownload={() => setRetainedSummary(FlightState.ABORTED)}
                onIdleDownloadReady={(session) => { idleAcknowledgedSession.current = session; }}
                onSetIdle={() => runAction("idle", () => returnToFlightSetup(
                    store.getSnapshot("flightState").value === FlightState.IDLE || idleAcknowledgedSession.current === store.getSession(),
                    endFlight,
                    () => {
                        idleAcknowledgedSession.current = null;
                        setRetainedSummary(null);
                        setFlightLog(null);
                        setStartedAt(null);
                        setElapsedMs(null);
                        setMaxAltitude(null);
                        setMaxVelocity(null);
                    },
                ))} />}
            {state === null && <Card variant="empty" className="flex flex-col items-center gap-2 px-3 py-6 text-center" role="status">
                <RocketIcon aria-hidden="true" className="h-6 w-6 text-zinc-600" />
                <p className="text-xs font-medium text-zinc-400">{connected ? "Awaiting flight controller" : "Rocket offline"}</p>
                <p className="text-[11px] leading-relaxed text-zinc-500">{connected ? "Waiting for flight controller status." : "Connect to the rocket to configure and monitor a flight."}</p>
            </Card>}
            {!connected && state !== null && <Card variant="warning" className="px-2.5 py-2 text-[11px] leading-relaxed text-amber-300/80" role="status">Radio link offline. Displayed status is the last received; live telemetry is unavailable.</Card>}
            {(actionError ?? stateError ?? locationError) && <Card variant="error" className="px-2.5 py-2 text-[11px] text-red-300 break-all" role="alert">{actionError ?? stateError ?? locationError}</Card>}
        </Card>
    );
}
