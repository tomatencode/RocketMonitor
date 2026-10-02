import { Card } from "../../../../shared/components/elements/Card";
import { LineChartIcon } from "../../../../shared/components/elements/Icons";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { accentColor1 } from "../../../../shared/styles";
import { useAltitudeHistory } from "./useAltitudeHistory";

export interface AltitudeChartPanelProps {
    className?: string;
}

/** Plots altitude over time. Placeholder until the altitude state lands. */
export function AltitudeChartPanel({ className = "" }: AltitudeChartPanelProps) {
    const { altitude, error, pending } = useAltitudeHistory();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<LineChartIcon />}
                title="Altitude Linechart"
                subtitle="real-time"
                alert={false}
                connected={true}
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
            {pending && (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-2.5 py-1.5">
                    <span className="text-[11px] text-zinc-500">
                        Altitude state not implemented yet.
                    </span>
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
