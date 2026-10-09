import { useCallback } from "react";
import { useRocketConnected, useRocketStatus, useRocketStatusStore, useRocketPyroContinuity } from "../../../RocketStatus/RocketStatusContext";

export type PyroStatus = ReturnType<typeof usePyroStatus>;

/** Hardware inputs are polled; software arming is session-cached. */
export function usePyroStatus({ channels, enabled = true }: { channels: number[]; enabled?: boolean }) {
    const connected = useRocketConnected();
    const hardware = useRocketStatus("pyroHardwareArmed");
    const software = useRocketStatus("pyroSoftwareArmed");
    const continuity = useRocketPyroContinuity(channels, enabled);
    const store = useRocketStatusStore();
    const channelKey = channels.join(",");
    const refresh = useCallback(() => {
        store.refresh("pyroHardwareArmed", "pyroSoftwareArmed",
            ...(channelKey === "" ? [] : channelKey.split(",").map(ch => `pyroContinuity:${Number(ch)}` as const)));
    }, [store, channelKey]);
    const snapshots = [hardware, software, ...continuity];
    const active = connected && enabled;
    // Recency describes live hardware probing, not the intentionally cached software setting.
    const live = [hardware, ...continuity];
    const timestamps = live.map(snapshot => snapshot.lastUpdatedAt).filter((time): time is number => time !== null);
    return {
        hardwareArmed: active ? hardware.value : null,
        softwareArmed: active ? software.value : null,
        continuity: continuity.map(snapshot => active ? snapshot.value : null),
        isLoading: active && snapshots.some(snapshot => !snapshot.hasValue),
        error: snapshots.find(snapshot => snapshot.error)?.error ?? null,
        lastUpdatedAt: timestamps.length === live.length ? Math.min(...timestamps) : null,
        refresh,
    };
}