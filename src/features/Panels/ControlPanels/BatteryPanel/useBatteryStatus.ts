import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";

export interface BatteryStatus {
    voltage: number | null;
    error: string | null;
}

/**
 * Reads the shared battery-voltage stream (GET_BATTERY_VOLTAGE). Polling is
 * owned by the RocketStatusStore, so any other component subscribing to
 * `batteryVoltage` shares the same poll.
 */
export function useBatteryStatus(): BatteryStatus {
    const { value, error } = useRocketStatus("batteryVoltage");
    return {
        voltage: value ?? null,
        error,
    };
}
