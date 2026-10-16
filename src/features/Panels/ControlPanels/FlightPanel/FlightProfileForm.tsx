import { useEffect, useRef, useState } from "react";
import type { FlightProfile } from "../../../RocketStatus/rocketTypes";
import { eulerXYZToQuaternion } from "../../../RocketStatus/rocketTypes";
import { MAX_FLIGHT_NAME_LENGTH, validateFlightProfile } from "../../../RocketStatus/flightProfile";
import { Button } from "../../../../shared/components/primitives/Button";
import { Input } from "../../../../shared/components/primitives/Input";
import { useRocketCommander } from "../../../RocketCommander/RocketCommanderContext";
import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";

interface FlightProfileFormProps {
    connected: boolean;
    launching: boolean;
    onLaunch: (profile: FlightProfile) => Promise<void>;
}

interface ProfileValues {
    flightName: string;
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
        <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
            <Input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => onChange(event.target.value)}
                className="w-full font-mono"
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
            <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Flight Name</span>
                <Input
                    type="text"
                    value={values.flightName}
                    maxLength={MAX_FLIGHT_NAME_LENGTH}
                    required
                    onChange={(event) => setField("flightName", event.target.value)}
                    title="Maximum 32 UTF-8 bytes (32 ASCII characters)"
                    className="w-full font-mono"
                />
            </label>
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Pyro Config</span>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Igniter channel" value={values.motorIgniterChannel} onChange={(value) => setField("motorIgniterChannel", value)} min={0} max={255} step="1" />
                    <Field label="Parachute channel" value={values.parachutePyroChannel} onChange={(value) => setField("parachutePyroChannel", value)} min={0} max={255} step="1" />
                </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">PD gains</span>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Kp" value={values.PDKp} onChange={(value) => setField("PDKp", value)} />
                    <Field label="Kd" value={values.PDKd} onChange={(value) => setField("PDKd", value)} />
                </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Attitude (degrees, X / Y / Z)</span>
                <div className="grid grid-cols-3 gap-2">
                    <Field label="Initial X" value={values.initialX_deg} onChange={(value) => setField("initialX_deg", value)} />
                    <Field label="Initial Y" value={values.initialY_deg} onChange={(value) => setField("initialY_deg", value)} />
                    <Field label="Initial Z" value={values.initialZ_deg} onChange={(value) => setField("initialZ_deg", value)} />
                </div>
            </div>
            {validationError && <p className="text-[11px] text-red-300">{validationError}</p>}
            {softwareArmed === false ? (
                <Button
                    variant="warning"
                    className="w-full px-3 py-2 text-xs"
                    disabled={!connected || armingPyro}
                    onClick={() => void handleSetPyroArmed(true)}
                    title="Arm the software pyro interlock before launching"
                >
                    {armingPyro ? "Arming Pyro..." : "Arm Pyro"}
                </Button>
            ) : (
                <Button
                    variant={"danger"}
                    className="w-full px-3 py-2 text-xs"
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
                    {launching ? "Launching..." : confirmingLaunch ? "Confirm Launch" : softwareArmed === null ? "Checking Pyro..." : "Launch"}
                </Button>
            )}
            {softwareArmed === true && (
                <Button
                    variant="success"
                    className="w-full px-3 py-2 text-xs"
                    disabled={!connected || armingPyro || launching}
                    onClick={() => void handleSetPyroArmed(false)}
                    title="Return the software pyro interlock to safe"
                >
                    {armingPyro ? "Disarming Pyro..." : "Disarm Pyro"}
                </Button>
            )}
        </div>
    );
}