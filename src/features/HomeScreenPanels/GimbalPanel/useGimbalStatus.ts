import { useEffect, useState } from "react";
import { useRadioLink } from "../../RadioLink/RadioLinkContext";

export interface GimbalStatus {
    degX_deg: number | null;
    degY_deg: number | null;
    error: string | null;
}

interface UseGimbalStatusOptions {
    enabled?: boolean;
}

/**
 * Polls the rocket's actual gimbal position via GET_GIMBAL as fast as the link
 * allows: a fresh request goes out the moment the previous one settles.
 */
export function useGimbalStatus({ enabled = true }: UseGimbalStatusOptions = {}): GimbalStatus {
    const { connected, getGimbal } = useRadioLink();

    const [degX, setDegX] = useState<number | null>(null);
    const [degY, setDegY] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled || !connected) {
            setDegX(null);
            setDegY(null);
            setError(null);
            return;
        }

        let cancelled = false;

        const poll = async () => {
            while (!cancelled) {
                try {
                    const g = await getGimbal();
                    if (cancelled) return;
                    setDegX(g.degX_deg);
                    setDegY(g.degY_deg);
                    setError(null);
                } catch (e) {
                    if (cancelled) return;
                    setError(e instanceof Error ? e.message : String(e));
                }
            }
        };

        void poll();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, enabled]);

    return { degX_deg: degX, degY_deg: degY, error };
}
