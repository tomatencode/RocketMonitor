import { BatteryPanel } from "../ControlPanels/BatteryPanel/BatteryPanel";
import { AltitudeChartPanel } from "../ControlPanels/AltitudeChartPanel/AltitudeChartPanel";
import { GimbalChartPanel } from "../ControlPanels/GimbalChartPanel/GimbalChartPanel";
import { RotationChartPanel } from "../ControlPanels/RotationChartPanel/RotationChartPanel";
import { FlightPanel } from "../ControlPanels/FlightPanel/FlightPanel";

export default function LaunchPanels() {
    return (
        <div className="relative z-10 flex flex-row min-h-0 gap-3 overflow-x-auto w-full pointer-events-none overflow-y-auto">
            <div className="w-80 shrink-0 flex flex-col p-3 gap-3 overflow-y-auto pointer-events-none [&>*]:shrink-0">
                <GimbalChartPanel />
                <AltitudeChartPanel  showButtons={false} />
                <RotationChartPanel />

            </div>

            <div className="w-80 shrink-0 flex flex-col p-3 gap-3 overflow-y-auto pointer-events-none ml-auto [&>*]:shrink-0">
                <BatteryPanel />
                <FlightPanel />
            </div>
        </div>
    );
}
