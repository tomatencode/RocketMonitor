import { useRocketConnected, useRocketStatus } from "../../../RocketStatus/RocketStatusContext";

export type PIDStatus = ReturnType<typeof usePIDStatus>;

/** Commander refreshes this shared session-cached status after setters. */
export function usePIDStatus() {
    const connected = useRocketConnected();
    const parameters = useRocketStatus("pidParameters");
    const controlling = useRocketStatus("controlling");
    return {
        parameters: connected ? parameters.value : null,
        controlling: connected ? controlling.value : null,
        isLoading: connected && (!parameters.hasValue || !controlling.hasValue),
        error: parameters.error ?? controlling.error,
        lastUpdatedAt: parameters.lastUpdatedAt,
    };
}