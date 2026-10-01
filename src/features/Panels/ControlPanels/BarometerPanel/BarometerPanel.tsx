import { Card } from "../../../../shared/components/elements/Card";
import { LineGraph } from "../../../../shared/components/elements/LineGraph";
import { accentColor1 } from "../../../../shared/styles";
import { useBarometerStatus } from "./useBarometerStatus";

export interface BarometerPanelProps {
    className?: string;
}

export function BarometerPanel({ className = "" }: BarometerPanelProps) {
    const { pressure, error } = useBarometerStatus();

    return (
        <Card className={`p-3 flex flex-col gap-2 ${className}`}>
            <span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Barometer Linechart</span>
            <LineGraph
                series={[
                    { label: "baro", color: accentColor1, data: pressure },
                ]}
                scale={1.2}
                yAutoscaleMin={950}
                yAutoscaleMax={1050}
                maxXinFrame={15}
                xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
                yAxis={{ label: "Baro", unit: "hPa", tickInterval: 50, labelEvery: 1 }}
            />
            {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-2.5 py-1.5">
                    <span className="text-[11px] text-red-300 break-all">{error}</span>
                </div>
            )}
        </Card>
    );
}

export default BarometerPanel;
