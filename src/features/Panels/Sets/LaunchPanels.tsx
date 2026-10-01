import { GyroscopePanel } from "../ControlPanels/GyroscopePanel/GyroscopePanel";
import { BarometerPanel } from "../ControlPanels/BarometerPanel/BarometerPanel";

export default function LaunchPanels() {
    return (
        <div className="relative z-10 flex flex-row min-h-0 gap-3 overflow-x-auto w-full pointer-events-none">
            <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pointer-events-none">
                <GyroscopePanel />
                <BarometerPanel />
            </div>

            <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pointer-events-none ml-auto">
                {/* Launch button and flight status */}
            </div>
        </div>
    );
}
