import { AccelerometerPanel } from "../ControlPanels/AccelerometerPanel/AccelerometerPanel";
import { GyroscopePanel } from "../ControlPanels/GyroscopePanel/GyroscopePanel";
import { BarometerPanel } from "../ControlPanels/BarometerPanel/BarometerPanel";
import { GimbalPanel } from "../ControlPanels/GimbalPanel/GimbalPanel";
import { PyroPanel } from "../ControlPanels/PyroPanel/PyroPanel";

export default function TestPanels() {
	return (
		<div className="relative z-10 flex flex-row min-h-0 gap-3 overflow-x-auto w-full pointer-events-none">
			<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pointer-events-none">
				<AccelerometerPanel />
				<GyroscopePanel />
				<BarometerPanel />
			</div>

			<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pointer-events-none ml-auto">
				<GimbalPanel />
				<PyroPanel />
			</div>
		</div>
	);
}
