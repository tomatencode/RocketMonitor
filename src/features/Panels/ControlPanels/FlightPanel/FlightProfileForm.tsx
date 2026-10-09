import { useEffect, useRef, useState } from "react";
import type { FlightProfile } from "../../../RocketStatus/rocketTypes";
import { eulerXYZToQuaternion } from "../../../RocketStatus/rocketTypes";
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
    countdownDuration_ms: string;
    motorBurnDuration_ms: string;
    pidKp: string;
    pidKi: string;
    pidKd: string;
    motorIgniterChannel: string;
    parachutePyroChannel: string;
    initialHeight_m: string;
    initialX_deg: string;
    initialY_deg: string;
    initialZ_deg: string;
    targetX_deg: string;
    targetY_deg: string;
    targetZ_deg: string;
}

const DEFAULT_VALUES: ProfileValues = {
    countdownDuration_ms: "5000",
    motorBurnDuration_ms: "3000",
    pidKp: "0",
    pidKi: "0",
    pidKd: "0",
    motorIgniterChannel: "0",
    parachutePyroChannel: "1",
    initialHeight_m: "0",
    initialX_deg: "0",
    initialY_deg: "0",
    initialZ_deg: "0",
    targetX_deg: "0",
    targetY_deg: "0",
    targetZ_deg: "0",
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
        const numbers = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, Number(value)]),
        ) as Record<keyof ProfileValues, number>;

        if (Object.values(numbers).some((value) => !Number.isFinite(value))) {
            setValidationError("Every flight profile value must be a number.");
            return;
        }
        if (numbers.countdownDuration_ms < 0 || numbers.motorBurnDuration_ms <= 0) {
            setValidationError("Countdown must be zero or more; burn duration must be greater than zero.");
            return;
        }
        if (!Number.isInteger(numbers.motorIgniterChannel) || !Number.isInteger(numbers.parachutePyroChannel)
            || numbers.motorIgniterChannel < 0 || numbers.motorIgniterChannel > 255
            || numbers.parachutePyroChannel < 0 || numbers.parachutePyroChannel > 255) {
            setValidationError("Pyro channels must be whole numbers from 0 to 255.");
            return;
        }

        if (!confirmingLaunch) {
            setConfirmingLaunch(true);
            return;
        }
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        setConfirmingLaunch(false);
        await onLaunch({
            countdownDuration_ms: numbers.countdownDuration_ms,
            motorBurnDuration_ms: numbers.motorBurnDuration_ms,
            initialRotation: eulerXYZToQuaternion(
                degreesToRadians(numbers.initialX_deg),
                degreesToRadians(numbers.initialY_deg),
                degreesToRadians(numbers.initialZ_deg),
            ),
            targetAngle: eulerXYZToQuaternion(
                degreesToRadians(numbers.targetX_deg),
                degreesToRadians(numbers.targetY_deg),
                degreesToRadians(numbers.targetZ_deg),
            ),
            pidKp: numbers.pidKp,
            pidKi: numbers.pidKi,
            pidKd: numbers.pidKd,
            motorIgniterChannel: numbers.motorIgniterChannel,
            parachutePyroChannel: numbers.parachutePyroChannel,
            initialHeight_m: numbers.initialHeight_m,
        });
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
            <div className="grid grid-cols-2 gap-2">
                <Field label="Countdown (ms)" value={values.countdownDuration_ms} onChange={(value) => setField("countdownDuration_ms", value)} min={0} step="100" />
                <Field label="Burn (ms)" value={values.motorBurnDuration_ms} onChange={(value) => setField("motorBurnDuration_ms", value)} min={1} step="100" />
                <Field label="Igniter channel" value={values.motorIgniterChannel} onChange={(value) => setField("motorIgniterChannel", value)} min={0} max={255} step="1" />
                <Field label="Parachute channel" value={values.parachutePyroChannel} onChange={(value) => setField("parachutePyroChannel", value)} min={0} max={255} step="1" />
                <Field label="Initial height (m)" value={values.initialHeight_m} onChange={(value) => setField("initialHeight_m", value)} />
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">PID gains</span>
                <div className="grid grid-cols-3 gap-2">
                    <Field label="Kp" value={values.pidKp} onChange={(value) => setField("pidKp", value)} />
                    <Field label="Ki" value={values.pidKi} onChange={(value) => setField("pidKi", value)} />
                    <Field label="Kd" value={values.pidKd} onChange={(value) => setField("pidKd", value)} />
                </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Attitude (degrees, X / Y / Z)</span>
                <div className="grid grid-cols-3 gap-2">
                    <Field label="Initial X" value={values.initialX_deg} onChange={(value) => setField("initialX_deg", value)} />
                    <Field label="Initial Y" value={values.initialY_deg} onChange={(value) => setField("initialY_deg", value)} />
                    <Field label="Initial Z" value={values.initialZ_deg} onChange={(value) => setField("initialZ_deg", value)} />
                    <Field label="Target X" value={values.targetX_deg} onChange={(value) => setField("targetX_deg", value)} />
                    <Field label="Target Y" value={values.targetY_deg} onChange={(value) => setField("targetY_deg", value)} />
                    <Field label="Target Z" value={values.targetZ_deg} onChange={(value) => setField("targetZ_deg", value)} />
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
                    disabled={!connected || softwareArmed !== true || launching}
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