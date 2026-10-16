import { useEffect, useRef, useState } from "react";
import type { FlightProfile } from "../../../RocketStatus/rocketTypes";
import { eulerXYZToQuaternion } from "../../../RocketStatus/rocketTypes";
import { MAX_FLIGHT_NAME_LENGTH, validateFlightProfile } from "../../../RocketStatus/flightProfile";
import { Button } from "../../../../shared/components/primitives/Button";
import { Input } from "../../../../shared/components/primitives/Input";
import { Card } from "../../../../shared/components/elements/Card";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { RocketIcon } from "../../../../shared/components/elements/Icons";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";

interface FlightProfileFormProps {
    connected: boolean;
    launching: boolean;
    onLaunch: (profile: FlightProfile) => Promise<void>;
}

interface ProfileValues {
    flightName: string;
    burnPhaseDuration: string;
    PDKp: string;
    PDKd: string;
    motorIgniterChannel: string;
    parachutePyroChannel: string;
    initialX_deg: string;
    initialY_deg: string;
    initialZ_deg: string;
}

const DEFAULT_VALUES: ProfileValues = {
    flightName: "",
    burnPhaseDuration: "6.5",
    PDKp: "0",
    PDKd: "0",
    motorIgniterChannel: "0",
    parachutePyroChannel: "0",
    initialX_deg: "0",
    initialY_deg: "0",
    initialZ_deg: "0",
};

const degreesToRadians = (degrees: number) => degrees * Math.PI / 180;

function Field({ label, value, onChange, step = "any", min, max }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    step?: string;
    min?: number;
    max?: number;
}) {
    return (
        <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] text-zinc-400">{label}</span>
            <Input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => onChange(event.target.value)}
                className="w-full min-w-0 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-sky-500/40"
            />
        </label>
    );
}

export function FlightProfileForm({ connected, launching, onLaunch }: FlightProfileFormProps) {
    const { setPyroSoftwareArmed } = useRocketCommander();
    const { value: softwareArmed } = useRocketStatus("pyroSoftwareArmed");
    const [values, setValues] = useState<ProfileValues>(DEFAULT_VALUES);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [armingPyro, setArmingPyro] = useState(false);
    const [confirmingLaunch, setConfirmingLaunch] = useState(false);
    const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!confirmingLaunch) return;
        confirmTimer.current = setTimeout(() => setConfirmingLaunch(false), 5000);
        return () => {
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
        };
    }, [confirmingLaunch]);

    const setField = (field: keyof ProfileValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
        setValidationError(null);
        setConfirmingLaunch(false);
    };

    const handleLaunch = async () => {
        if (!connected || softwareArmed !== true || launching || armingPyro) return;
        const { flightName, ...numericValues } = values;
        const numbers = Object.fromEntries(
            Object.entries(numericValues).map(([key, value]) => [key, Number(value)]),
        ) as Record<keyof typeof numericValues, number>;

        if (Object.values(numericValues).some(value => !value.trim())
            || Object.values(numbers).some((value) => !Number.isFinite(value))) {
            setValidationError("Every numeric flight profile value must be a number and cannot be empty.");
            return;
        }
        const profile: FlightProfile = {
            flightName,
            motorBurnDuration_ms: Math.round(numbers.burnPhaseDuration * 1000),
            initialRotation: eulerXYZToQuaternion(
                degreesToRadians(numbers.initialX_deg),
                degreesToRadians(numbers.initialY_deg),
                degreesToRadians(numbers.initialZ_deg),
            ),
            PDKp: numbers.PDKp,
            PDKd: numbers.PDKd,
            motorIgniterChannel: numbers.motorIgniterChannel,
            parachutePyroChannel: numbers.parachutePyroChannel,
        };
        try {
            validateFlightProfile(profile);
        } catch (error) {
            setValidationError(error instanceof Error ? error.message : String(error));
            return;
        }

        if (!confirmingLaunch) {
            setConfirmingLaunch(true);
            return;
        }
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        setConfirmingLaunch(false);
        await onLaunch(profile);
    };

    const handleSetPyroArmed = async (armed: boolean) => {
        if (!connected || softwareArmed === null || softwareArmed === armed || armingPyro) return;
        setValidationError(null);
        setArmingPyro(true);
        try {
            await setPyroSoftwareArmed(armed);
            setConfirmingLaunch(false);
        } catch (error) {
            setValidationError(error instanceof Error ? error.message : String(error));
        } finally {
            setArmingPyro(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <Card variant="inner" className="flex min-w-0 flex-col gap-3 p-3" aria-label="Flight profile">
                <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Flight Name</span>
                    <Input
                        type="text"
                        placeholder="Flight-01"
                        value={values.flightName}
                        maxLength={MAX_FLIGHT_NAME_LENGTH}
                        required
                        onChange={(event) => setField("flightName", event.target.value)}
                        title="Maximum 32 UTF-8 bytes (32 ASCII characters)"
                        className="w-full min-w-0 font-mono focus-visible:ring-2 focus-visible:ring-sky-500/40"
                    />
                </label>
                <div className="border-t border-zinc-800/80 pt-3">
                    <Field label="Burn Phase Duration (s)" value={values.burnPhaseDuration} onChange={(value) => setField("burnPhaseDuration", value)} min={0.001} max={4294967.295} step="0.001" />
                </div>
                <div className="border-t border-zinc-800/80 pt-3">
                    <fieldset className="min-w-0 border-0 p-0">
                        <legend className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">Pyro channels</legend>
                        <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">Ignition and recovery outputs</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Igniter channel" value={values.motorIgniterChannel} onChange={(value) => setField("motorIgniterChannel", value)} min={0} max={255} step="1" />
                            <Field label="Parachute channel" value={values.parachutePyroChannel} onChange={(value) => setField("parachutePyroChannel", value)} min={0} max={255} step="1" />
                        </div>
                    </fieldset>
                </div>
                <div className="border-t border-zinc-800/80 pt-3">
                    <fieldset className="min-w-0 border-0 p-0">
                        <legend className="mb-2 text-[10px] uppercase tracking-wider text-zinc-400">Guidance & attitude</legend>
                        <p className="mb-2 text-[10px] text-zinc-500">PD gains</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Kp" value={values.PDKp} onChange={(value) => setField("PDKp", value)} />
                            <Field label="Kd" value={values.PDKd} onChange={(value) => setField("PDKd", value)} />
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                            <span className="text-[10px] text-zinc-500">Initial attitude · degrees</span>
                            <div className="grid grid-cols-3 gap-2">
                                <Field label="Initial X" value={values.initialX_deg} onChange={(value) => setField("initialX_deg", value)} />
                                <Field label="Initial Y" value={values.initialY_deg} onChange={(value) => setField("initialY_deg", value)} />
                                <Field label="Initial Z" value={values.initialZ_deg} onChange={(value) => setField("initialZ_deg", value)} />
                            </div>
                        </div>
                    </fieldset>
                </div>
            </Card>
            <Card variant={softwareArmed === true ? "warning" : "inner"} className="flex flex-col gap-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Launch control</span>
                    <StatusPill tone={!connected ? "neutral" : softwareArmed === true ? "warn" : "neutral"}>
                        {!connected ? "Offline" : softwareArmed === true ? "Pyro armed" : softwareArmed === false ? "Pyro safe" : "Checking pyro"}
                    </StatusPill>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400" role="status">
                    {!connected ? "Connect to the rocket to enable launch controls."
                        : confirmingLaunch ? "Click Confirm Launch within five seconds to start the countdown."
                        : softwareArmed === true ? "Software pyro interlock armed. Verify the launch area is clear."
                        : softwareArmed === false ? "Review the profile, then arm the software pyro interlock."
                        : "Waiting for the software pyro interlock status."}
                </p>
                {validationError && <Card variant="error" className="px-2.5 py-2 text-[11px] text-red-300" role="alert">{validationError}</Card>}
                {softwareArmed === false ? (
                    <Button
                        variant="warning"
                        className="w-full px-3 py-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                        disabled={!connected || armingPyro}
                        onClick={() => void handleSetPyroArmed(true)}
                        title="Arm the software pyro interlock before launching"
                    >
                        {armingPyro ? "Arming Pyro..." : "Arm Pyro"}
                    </Button>
                ) : (
                    <Button
                        variant={"danger"}
                        className="flex w-full items-center justify-center gap-2 px-3 py-3 text-xs uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                        disabled={!connected || softwareArmed !== true || launching || armingPyro}
                        onClick={() => void handleLaunch()}
                        title={
                            !connected
                                ? "Radio link offline"
                                : softwareArmed !== true
                                  ? "Waiting for the software pyro interlock"
                                  : confirmingLaunch
                                    ? "Click again within five seconds to confirm launch"
                                    : "Start the configured flight countdown"
                        }
                    >
                        <RocketIcon aria-hidden="true" className="h-4 w-4" />
                        {launching ? "Launching..." : confirmingLaunch ? "Confirm Launch" : softwareArmed === null ? "Checking Pyro..." : "Launch"}
                    </Button>
                )}
                {softwareArmed === true && (
                    <Button
                        variant="success"
                        className="w-full px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                        disabled={!connected || armingPyro || launching}
                        onClick={() => void handleSetPyroArmed(false)}
                        title="Return the software pyro interlock to safe"
                    >
                        {armingPyro ? "Disarming Pyro..." : "Disarm Pyro"}
                    </Button>
                )}
            </Card>
        </div>
    );
}
