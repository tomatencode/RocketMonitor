/** Returns cleanup so a replaced message or unmounted panel cannot expire later feedback. */
export function scheduleFeedbackDismissal(dismiss: () => void): () => void {
    const timer = setTimeout(dismiss, 10_000);
    return () => clearTimeout(timer);
}