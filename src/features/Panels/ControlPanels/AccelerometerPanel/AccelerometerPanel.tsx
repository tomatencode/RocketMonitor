import { Card } from "../../../../shared/components/elements/Card";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { accentColor1, accentColor2, accentColor3 } from "../../../../shared/styles";
import { useAccelerometerStatus } from "./useAccelerometerStatus";

export interface AccelerometerPanelProps {
    className?: string;
}

export function AccelerometerPanel({ className = "" }: AccelerometerPanelProps) {
    const { accelX, accelY, accelZ, error } = useAccelerometerStatus();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Accelerometer Linechart</span>
            <LineGraph
                series={[
                    { label: "accelX", color: accentColor1, data: accelX },
                    { label: "accelY", color: accentColor2, data: accelY },
                    { label: "accelZ", color: accentColor3, data: accelZ },
                ]}
                scale={1.2}
                yAutoscaleMin={-12}
                yAutoscaleMax={12}
                maxXinFrame={15}
                xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
                yAxis={{ label: "Accel", unit: "m/s²", tickInterval: 2, labelEvery: 2 }}
            />
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default AccelerometerPanel;
