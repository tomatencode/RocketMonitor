import { Card } from "../../../../shared/components/elements/Card";
import { LineChartIcon } from "../../../../shared/components/elements/Icons";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { accentColor1, accentColor2 } from "../../../../shared/styles";
import { useGimbalHistory } from "./useGimbalHistory";

export interface GimbalChartPanelProps {
    className?: string;
}

/** Plots the gimbal X/Y deflection over time, next to the manual controls. */
export function GimbalChartPanel({ className = "" }: GimbalChartPanelProps) {
    const { gimbalX, gimbalY, error } = useGimbalHistory();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<LineChartIcon />}
                title="Gimbal Linechart"
                subtitle="real-time"
                alert={false}
                connected={true}
            />
            <LineGraph
                series={[
                    { label: "gimbalX", color: accentColor1, data: gimbalX },
                    { label: "gimbalY", color: accentColor2, data: gimbalY },
                ]}
                scale={1.2}
                yAutoscaleMin={-10}
                yAutoscaleMax={10}
                maxXinFrame={15}
                xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
                yAxis={{ label: "Angle", unit: "°", tickInterval: 5, labelEvery: 2 }}
            />
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default GimbalChartPanel;
