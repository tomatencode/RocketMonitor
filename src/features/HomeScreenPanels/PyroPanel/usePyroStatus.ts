import { useCallback, useEffect, useRef, useState } from "react";
import { useRadioLink } from "../../RadioLink/RadioLinkContext";

export interface PyroStatus {
    hardwareArmed: boolean | null;
    softwareArmed: boolean | null;
    continuity: (boolean | null)[];
    isLoading: boolean;
    error: string | null;
    lastUpdatedAt: number | null;
    refresh: () => void;
    refreshCounter: number;
}

interface UsePyroStatusOptions {
    channels: number[];
    pollIntervalMs?: number;
    enabled?: boolean;
}

/**
 * Polls pyro arm + continuity state through the RadioLink.
 * Fires every request in one tick so the transport batches them into a single
 * radio frame, mirroring the HomeScreen IMU/baro polling pattern.
 */
export function usePyroStatus({
    channels,
    pollIntervalMs = 1500,
    enabled = true,
}: UsePyroStatusOptions): PyroStatus {
    const {
        connected,
        getPyroContinuity,
        getPyroSoftwareArmed,
        getPyroHardwareArmed,
    } = useRadioLink();

    const [hardwareArmed, setHardwareArmed] = useState<boolean | null>(null);
    const [softwareArmed, setSoftwareArmed] = useState<boolean | null>(null);
    const [continuity, setContinuity] = useState<(boolean | null)[]>(
        () => channels.map(() => null),
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const channelsRef = useRef(channels);
    channelsRef.current = channels;

    const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

    // Reset continuity slots when the channel list changes.
    useEffect(() => {
        setContinuity(channels.map(() => null));
        setHardwareArmed(null);
        setSoftwareArmed(null);
    }, [channels.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

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
            const chs = channelsRef.current;
            try {
                // One Promise.all; the transport batches these into a single frame.
                const [hw, sw, ...conts] = await Promise.all([
                    getPyroHardwareArmed(),
                    getPyroSoftwareArmed(),
                    ...chs.map((ch) => getPyroContinuity(ch)),
                ]);

                if (cancelled) return;
                setHardwareArmed(hw);
                setSoftwareArmed(sw);
                setContinuity(conts);
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
    }, [connected, enabled, pollIntervalMs, refreshCounter, channels.join(",")]);

    // Clear stale state when link drops so the panel visibly goes offline.
    useEffect(() => {
        if (!connected) {
            setHardwareArmed(null);
            setSoftwareArmed(null);
            setContinuity(channelsRef.current.map(() => null));
            setIsLoading(false);
        }
    }, [connected]);

    return {
        hardwareArmed,
        softwareArmed,
        continuity,
        isLoading,
        error,
        lastUpdatedAt,
        refresh,
        refreshCounter,
    };
}
