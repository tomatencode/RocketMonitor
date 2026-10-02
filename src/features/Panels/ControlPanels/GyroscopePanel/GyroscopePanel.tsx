import { Card } from "../../../../shared/components/elements/Card";
import { LineChartIcon } from "../../../../shared/components/elements/Icons";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { PanelHeader } from "../../../../shared/components/elements/PanelHeader";
import { accentColor1, accentColor2, accentColor3 } from "../../../../shared/styles";
import { useGyroscopeStatus } from "./useGyroscopeStatus";

export interface GyroscopePanelProps {
    className?: string;
}

export function GyroscopePanel({ className = "" }: GyroscopePanelProps) {
    const { gyroX, gyroY, gyroZ, error } = useGyroscopeStatus();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <PanelHeader
                icon={<LineChartIcon />}
                title="Gyroscope Linechart"
                subtitle="real-time"
                alert={false}
                connected={true}
            />
            <LineGraph
                series={[
                    { label: "gyroX", color: accentColor1, data: gyroX },
                    { label: "gyroY", color: accentColor2, data: gyroY },
                    { label: "gyroZ", color: accentColor3, data: gyroZ },
                ]}
                scale={1.2}
                yAutoscaleMin={-6}
                yAutoscaleMax={6}
                maxXinFrame={15}
                xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
                yAxis={{ label: "Gyro", unit: "rad/s", tickInterval: 1, labelEvery: 2 }}
            />
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default GyroscopePanel;
