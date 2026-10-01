import { useRocketStatus } from "../../../RocketStatus/RocketStatusContext";

export interface GimbalStatus {
    degX_deg: number | null;
    degY_deg: number | null;
    error: string | null;
}

/**
 * Reads the shared gimbal-position stream (GET_GIMBAL). Polling is owned by the
 * RocketStatusStore, so any other component subscribing to `gimbal` shares it.
 */
export function useGimbalStatus(): GimbalStatus {
    const { value, error } = useRocketStatus("gimbal");
    return {
        degX_deg: value?.degX_deg ?? null,
        degY_deg: value?.degY_deg ?? null,
        error,
    };
}
