import BackgroundScene from "../features/3DScene/components/BackgroundScene";
import { useRocketOrientation } from "../features/3DScene/useRocketOrientation";
import { AccelerometerPanel } from "../features/HomeScreenPanels/AccelerometerPanel/AccelerometerPanel";
import { GyroscopePanel } from "../features/HomeScreenPanels/GyroscopePanel/GyroscopePanel";
import { BarometerPanel } from "../features/HomeScreenPanels/BarometerPanel/BarometerPanel";
import { GimbalPanel } from "../features/HomeScreenPanels/GimbalPanel/GimbalPanel";
import { PyroPanel } from "../features/HomeScreenPanels/PyroPanel/PyroPanel";

const ROCKET_POSITION: [number, number, number] = [0, 0.175, 0];

export default function HomeScreen() {
	const rotation = useRocketOrientation();

	return (
		<div className="relative flex h-full bg-transparent text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3">
			<BackgroundScene RocketPosition={ROCKET_POSITION} RocketRotation={rotation} />
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
		</div>
	);
}
