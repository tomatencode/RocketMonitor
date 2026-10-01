import { useCallback, useEffect, useState } from "react";
import { useRadioLink } from "../../RadioLink/RadioLinkContext";

export interface GimbalStatus {
    degX_deg: number | null;
    degY_deg: number | null;
    isLoading: boolean;
    error: string | null;
    lastUpdatedAt: number | null;
    refresh: () => void;
}

interface UseGimbalStatusOptions {
    pollIntervalMs?: number;
    enabled?: boolean;
}

/** Polls the rocket's actual gimbal position via GET_GIMBAL. */
export function useGimbalStatus({
    pollIntervalMs = 1500,
    enabled = true,
}: UseGimbalStatusOptions): GimbalStatus {
    const { connected, getGimbal } = useRadioLink();

    const [degX, setDegX] = useState<number | null>(null);
    const [degY, setDegY] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

    useEffect(() => {
        if (!enabled || !connected) return;

        let cancelled = false;
        let timerId: ReturnType<typeof setTimeout> | null = null;
        let pollInFlight = false;

        // Reschedule on a timer instead of from the request's `finally`: a
        // cancelled cycle (manual refresh / unmount) must never be able to
        // leave the loop dead, which is what happened when `refresh()` was
        // called while a GET_GIMBAL was still in flight.
        const scheduleNext = () => {
            if (cancelled) return;
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(pollOnce, pollIntervalMs);
        };

        async function pollOnce() {
            if (cancelled || pollInFlight) return;
            pollInFlight = true;
            try {
                const g = await getGimbal();
                if (cancelled) return;
                setDegX(g.degX_deg);
                setDegY(g.degY_deg);
                setError(null);
                setLastUpdatedAt(Date.now());
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                pollInFlight = false;
                setIsLoading(false);
                scheduleNext();
            }
        }

        setIsLoading(true);
        void pollOnce();

        return () => {
            // Stop rescheduling, but let any in-flight request settle — it is
            // what keeps `pollInFlight` honest for the next cycle.
            cancelled = true;
            if (timerId) clearTimeout(timerId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, enabled, pollIntervalMs, refreshCounter]);

    useEffect(() => {
        if (!connected) {
            setDegX(null);
            setDegY(null);
            setIsLoading(false);
        }
    }, [connected]);

    return { degX_deg: degX, degY_deg: degY, isLoading, error, lastUpdatedAt, refresh };
}
