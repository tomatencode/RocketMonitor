import { useCallback, useEffect, useState } from "react";
import { useRadioLink } from "../../../RadioLink/RadioLinkContext";
import type { PIDParameters } from "../../../RadioLink/useRadioCommands";

export interface PIDStatus {
    parameters: PIDParameters | null;
    controlling: boolean | null;
    isLoading: boolean;
    error: string | null;
    lastUpdatedAt: number | null;
    refresh: () => void;
}

interface UsePIDStatusOptions {
    pollIntervalMs?: number;
    enabled?: boolean;
}

/**
 * Polls PID parameters + controlling state through the RadioLink.
 * Fires both requests in one tick so the transport batches them into a single
 * radio frame, mirroring the PyroPanel polling pattern.
 *
 * `parameters` stays null until the firmware has parameters configured
 * (GET_PID_PARAMETERS answers FAILURE in that case — the normal
 * "not configured yet" outcome, not an error).
 */
export function usePIDStatus({ pollIntervalMs = 1500, enabled = true }: UsePIDStatusOptions = {}): PIDStatus {
    const { connected, getPIDParameters, getControlling } = useRadioLink();

    const [parameters, setParameters] = useState<PIDParameters | null>(null);
    const [controlling, setControlling] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

    useEffect(() => {
        if (!enabled || !connected) {
            return;
        }

        let cancelled = false;
        let pollInFlight = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const pollOnce = async () => {
            if (cancelled || pollInFlight) return;
            pollInFlight = true;
            try {
                // One Promise.all; the transport batches these into a single frame.
                const [params, ctrl] = await Promise.all([getPIDParameters(), getControlling()]);

                if (cancelled) return;
                setParameters(params);
                setControlling(ctrl);
                setError(null);
                setLastUpdatedAt(Date.now());
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            } finally {
                pollInFlight = false;
                if (!cancelled) {
                    setIsLoading(false);
                    timeoutId = setTimeout(pollOnce, pollIntervalMs);
                }
            }
        };

        setIsLoading(true);
        // Manual refresh triggers an immediate extra poll cycle.
        void pollOnce();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, enabled, pollIntervalMs, refreshCounter]);

    // Clear stale state when link drops so the panel visibly goes offline.
    useEffect(() => {
        if (!connected) {
            setParameters(null);
            setControlling(null);
            setIsLoading(false);
        }
    }, [connected]);

    return { parameters, controlling, isLoading, error, lastUpdatedAt, refresh };
}
