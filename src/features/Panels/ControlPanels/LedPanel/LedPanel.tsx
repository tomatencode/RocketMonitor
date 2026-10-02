import { useState } from "react";
import { Card } from "../../../../shared/components/elements/Card";
import { LedIcon } from "../../../../shared/components/elements/Icons";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { Button } from "../../../../shared/components/primitives/Button";
import { Input } from "../../../../shared/components/primitives/Input";
import { useRadioLink } from "../../../RadioLink/RadioLinkContext";

export interface LedPanelProps {
    className?: string;
}

/**
 * Flashes the onboard LED, mirroring the BuzzerPanel's single-button layout.
 * The duration input is optional: leave it empty to flash with the LED's
 * default duration, or set 1-65535 ms for a custom one.
 */
export function LedPanel({ className = "" }: LedPanelProps) {
    const { connected, flashLed } = useRadioLink();
    const [durationMs, setDurationMs] = useState("");
    const [flashing, setFlashing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parsedDurationMs = durationMs.trim() === "" ? undefined : Number(durationMs);
    const durationInvalid =
        parsedDurationMs !== undefined &&
        (!Number.isInteger(parsedDurationMs) || parsedDurationMs < 1 || parsedDurationMs > 65535);

    const handleFlash = async () => {
        setError(null);
        setFlashing(true);
        try {
            await flashLed(parsedDurationMs);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setFlashing(false);
        }
    };

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<LedIcon />}
                title="LED"
                subtitle={undefined}
                alert={false}
                connected={connected}
            />
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    min={1}
                    max={65535}
                    step={50}
                    value={durationMs}
                    disabled={!connected}
                    onChange={(e) => setDurationMs(e.target.value)}
                    placeholder="default"
                    title="Flash duration in ms (1-65535); leave empty for the LED's default"
                    aria-label="Flash duration in ms"
                    className="w-20 px-1.5 text-right font-mono"
                />
                <span className="text-[10px] text-zinc-500">ms</span>
                <Button
                    variant="ghost"
                    className="px-3 py-1.5 text-xs flex-1"
                    disabled={!connected || durationInvalid || flashing}
                    title={durationInvalid ? "Duration must be a whole number of 1-65535 ms" : "Flash the LED"}
                    onClick={handleFlash}
                >
                    {flashing ? "Flashing..." : "Flash LED"}
                </Button>
            </div>
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default LedPanel;