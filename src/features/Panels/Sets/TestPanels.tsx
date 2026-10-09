import { AccelerometerPanel } from "../ControlPanels/AccelerometerPanel/AccelerometerPanel";
import { GyroscopePanel } from "../ControlPanels/GyroscopePanel/GyroscopePanel";
import { BarometerPanel } from "../ControlPanels/BarometerPanel/BarometerPanel";
import { GimbalChartPanel } from "../ControlPanels/GimbalChartPanel/GimbalChartPanel";
import { RotationChartPanel } from "../ControlPanels/RotationChartPanel/RotationChartPanel";
import { AltitudeChartPanel } from "../ControlPanels/AltitudeChartPanel/AltitudeChartPanel";
import { GimbalPanel } from "../ControlPanels/GimbalPanel/GimbalPanel";
import { PyroPanel } from "../ControlPanels/PyroPanel/PyroPanel";
import { BuzzerPanel } from "../ControlPanels/BuzzerPanel/BuzzerPanel";
import { LedPanel } from "../ControlPanels/LedPanel/LedPanel";
import { BatteryPanel } from "../ControlPanels/BatteryPanel/BatteryPanel";
import { RotationPanel } from "../ControlPanels/RotationPanel/RotationPanel";
import { PIDPanel } from "../ControlPanels/PIDPanel/PIDPanel";
import { LoggingPanel } from "../ControlPanels/LoggingPanel/LoggingPanel";

export default function TestPanels() {
	return (
		<div className="relative z-10 flex flex-row min-h-0 gap-3 overflow-x-auto w-full pointer-events-none">
			<div className="shrink-0 flex flex-row overflow-y-auto pointer-events-none [&>*]:shrink-0">
				<div className="w-80 shrink-0 flex flex-col py-3 pl-3 gap-3 pointer-events-none [&>*]:shrink-0">
					<GimbalChartPanel />
					<RotationChartPanel />
					<AltitudeChartPanel />
				</div>
				<div className="w-80 shrink-0 flex flex-col p-3 gap-3 pointer-events-none [&>*]:shrink-0">
					<AccelerometerPanel />
					<GyroscopePanel />
					<BarometerPanel />
				</div>
			</div>

			<div className="shrink-0 flex flex-row overflow-y-auto pointer-events-none ml-auto [&>*]:shrink-0">
				<div className="w-80 shrink-0 flex flex-col p-3 gap-3 pointer-events-none [&>*]:shrink-0">
					<BuzzerPanel />
					<LedPanel />
					<RotationPanel />
					<PIDPanel />
					<LoggingPanel />
				</div>
				<div className="w-80 shrink-0 flex flex-col py-3 pr-3 gap-3 pointer-events-none [&>*]:shrink-0">
					<BatteryPanel />
					<PyroPanel />
					<GimbalPanel />
				</div>
			</div>
		</div>
	);
}
