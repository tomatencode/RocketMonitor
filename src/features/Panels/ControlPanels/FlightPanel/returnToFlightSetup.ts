/** Dismiss a retained summary without repeating an already acknowledged END_FLIGHT. */
export async function returnToFlightSetup(alreadyIdle: boolean, endFlight: () => Promise<void>, resetSummary: () => void): Promise<void> {
    if (!alreadyIdle) await endFlight();
    resetSummary();
}