import { useState } from "react";
import { Card } from "../../../../shared/components/elements/Card";
import { LineChartIcon } from "../../../../shared/components/elements/Icons";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { StatusPill } from "../../../../shared/components/elements/StatusPill";
import { Button } from "../../../../shared/components/primitives/Button";
import { Input } from "../../../../shared/components/primitives/Input";
import { accentColor1 } from "../../../../shared/styles";
import { useRadioLink } from "../../../RadioLink/RadioLinkContext";
import { useAltitudeHistory } from "./useAltitudeHistory";

export interface AltitudeChartPanelProps {
    className?: string;
}

/** Plots height above the launch pad (baro height) over time. */
export function AltitudeChartPanel({ className = "" }: AltitudeChartPanelProps) {
    const { connected, calibrateBaroHeight } = useRadioLink();
    const { altitude, height, error, reset } = useAltitudeHistory();

    // Reference height the current barometric measurement should represent (0 on the pad).
    const [targetHeight, setTargetHeight] = useState("0");
    const [calibrating, setCalibrating] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const parsedTargetHeight = Number(targetHeight);
    const targetHeightInvalid = targetHeight.trim() === "" || !Number.isFinite(parsedTargetHeight);

    const handleCalibrate = async () => {
        setActionError(null);
        setCalibrating(true);
        try {
            await calibrateBaroHeight(parsedTargetHeight);
            // Samples plotted against the previous reference are stale now.
            reset();
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        } finally {
            setCalibrating(false);
        }
    };

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<LineChartIcon />}
                title="Altitude Linechart"
                subtitle="real-time"
                alert={false}
                connected={true}
                end={
                    <StatusPill tone={height === null ? "neutral" : "info"}>
                        {height === null ? "No data" : `${height.toFixed(2)} m`}
                    </StatusPill>
                }
            />
            <LineGraph
                series={[
                    { label: "altitude", color: accentColor1, data: altitude },
                ]}
                scale={1.2}
                yAutoscaleMin={0}
                yAutoscaleMax={100}
                maxXinFrame={15}
                xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
                yAxis={{ label: "Altitude", unit: "m", tickInterval: 25, labelEvery: 2 }}
            />
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    step={0.1}
                    value={targetHeight}
                    disabled={!connected}
                    onChange={(e) => setTargetHeight(e.target.value)}
                    placeholder="0"
                    title="Height the current barometric reading should represent, in metres"
                    aria-label="Calibration target height in metres"
                    className="w-20 px-1.5 text-right font-mono"
                />
                <span className="text-[10px] text-zinc-500">m</span>
                <Button
                    variant="ghost"
                    className="px-3 py-1.5 text-xs flex-1"
                    disabled={!connected || targetHeightInvalid || calibrating}
                    title={targetHeightInvalid
                        ? "Target height must be a number"
                        : `Re-base the barometric height so the current reading reads ${parsedTargetHeight} m`}
                    onClick={handleCalibrate}
                >
                    {calibrating ? "Calibrating..." : "Calibrate Height"}
                </Button>
            </div>
            {actionError && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{actionError}</span>
                </div>
            )}
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default AltitudeChartPanel;
