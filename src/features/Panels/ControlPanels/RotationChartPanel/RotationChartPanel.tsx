import { Card } from "../../../../shared/components/elements/Card";
import { LineChartIcon } from "../../../../shared/components/elements/Icons";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { accentColor1, accentColor2, accentColor3 } from "../../../../shared/styles";
import { useRotationHistory } from "./useRotationHistory";

export interface RotationChartPanelProps {
    className?: string;
}

/** Plots the rocket's roll/pitch/yaw attitude over time (in degrees). */
export function RotationChartPanel({ className = "" }: RotationChartPanelProps) {
    const { roll, pitch, yaw, error } = useRotationHistory();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<LineChartIcon />}
                title="Rotation Linechart"
                subtitle="real-time"
                alert={false}
                connected={true}
            />
            <LineGraph
                series={[
                    { label: "roll", color: accentColor1, data: roll },
                    { label: "pitch", color: accentColor2, data: pitch },
                    { label: "yaw", color: accentColor3, data: yaw },
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

export default RotationChartPanel;
