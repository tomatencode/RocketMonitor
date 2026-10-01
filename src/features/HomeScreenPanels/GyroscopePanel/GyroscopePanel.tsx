import { Card } from "../../../shared/components/elements/Card";
import { LineGraph } from "../../../shared/components/elements/LineGraph";
import { useGyroscopeStatus } from "./useGyroscopeStatus";

export interface GyroscopePanelProps {
    className?: string;
}

export function GyroscopePanel({ className = "" }: GyroscopePanelProps) {
    const { gyroX, gyroY, gyroZ, error } = useGyroscopeStatus();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Gyroscope Linechart</span>
            <LineGraph
                series={[
                    { label: "gyroX", color: "#38bdf8", data: gyroX },
                    { label: "gyroY", color: "#f472b6", data: gyroY },
                    { label: "gyroZ", color: "#34d399", data: gyroZ },
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
