import { useEffect, useState } from "react";
import { useRadioLink } from "../features/RadioLink/RadioLinkContext";
import { Button } from "../shared/components/primitives/Button";
import { Card } from "../shared/components/primitives/Card";
import { Input } from "../shared/components/primitives/Input";
import { LineGraph } from "../shared/components/primitives/LineGraph";
import BackgroundScene from "../features/3DScene/components/BackgroundScene";

export default function HomeScreen() {
	const {
		connected,
		setGimbalPos,
		setRotation,
		beepBuzzer,
		firePyroChanel,
		requestIMU,
		requestBaro,
		requestRotation,
		sendQueuedCommands
	} = useRadioLink();


	const [plannedRotationX, setPlannedRotationX] = useState("0");
	const [plannedRotationY, setPlannedRotationY] = useState("0");
	const [plannedRotationZ, setPlannedRotationZ] = useState("0");

	const [plannedGimbalX, setPlannedGimbalX] = useState("0");
	const [plannedGimbalY, setPlannedGimbalY] = useState("0");

	const [plannedChannel, setPlannedChannel] = useState("1");

	const [commandError, setCommandError] = useState<string | null>(null);

	const [rotationX, setRotationX] = useState<number>(0);
	const [rotationY, setRotationY] = useState<number>(0);
	const [rotationZ, setRotationZ] = useState<number>(0);

	const [accelX, setAccelX] = useState<{ x: number; y: number }[]>([]);
	const [accelY, setAccelY] = useState<{ x: number; y: number }[]>([]);
	const [accelZ, setAccelZ] = useState<{ x: number; y: number }[]>([]);
	const [gyroX, setGyroX] = useState<{ x: number; y: number }[]>([]);
	const [gyroY, setGyroY] = useState<{ x: number; y: number }[]>([]);
	const [gyroZ, setGyroZ] = useState<{ x: number; y: number }[]>([]);
	const [pressure, setPressure] = useState<{ x: number; y: number }[]>([]);
	const chartStartT = Date.now();

	const rocketPosition: [number, number, number] = [
		0,
		0.175,
		0
	];

	useEffect(() => {
		let cancelled = false;
		const pollRadio = async () => {
			while (!cancelled) {
				if (!connected) {
					await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit before retrying
					return;
				}
				let imu;
				let baro;
				let rotation;
				try {
					imu = requestIMU();
					baro = requestBaro();
					rotation = requestRotation();
					sendQueuedCommands();
					await Promise.all([imu, baro, rotation]);
					imu = await imu;
					baro = await baro;
					rotation = await rotation;

				} catch (e) {
					console.error("Failed to Poll data:", e);
					await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit before retrying
					continue;
				}

				setRotationX(rotation.roll_rad);
				setRotationY(rotation.pitch_rad);
				setRotationZ(rotation.yaw_rad);

				const t = (Date.now() - chartStartT) / 1000;
				// Cap on stored samples is just a memory bound, not the visible window - LineGraph's maxXinFrame handles that.
				setAccelX(prev => [...prev.slice(-100), { x: t, y: imu.accelX_m_s2 }]);
				setAccelY(prev => [...prev.slice(-100), { x: t, y: imu.accelY_m_s2 }]);
				setAccelZ(prev => [...prev.slice(-100), { x: t, y: imu.accelZ_m_s2 }]);
				setGyroX(prev => [...prev.slice(-100), { x: t, y: imu.gyroX_rad_s }]);
				setGyroY(prev => [...prev.slice(-100), { x: t, y: imu.gyroY_rad_s }]);
				setGyroZ(prev => [...prev.slice(-100), { x: t, y: imu.gyroZ_rad_s }]);
				setPressure(prev => [...prev.slice(-100), { x: t, y: baro.pressure }]);
			}
		};
		pollRadio();
		return () => { cancelled = true; };
	}, [connected]);

	async function run(action: () => Promise<void>) {
		setCommandError(null);
		try {
			await action();
		} catch (e) {
			setCommandError(String(e));
		}
	}

	return (
		<div className="relative flex h-full bg-transparent text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3">
			<BackgroundScene RocketPosition={rocketPosition} RocketRotation={[rotationX, rotationY, rotationZ]} />
			<div className="relative z-10 flex flex-row min-h-0 gap-3 overflow-x-auto w-full pointer-events-none">
				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pointer-events-none">
					<Card className="p-3 flex flex-col gap-2">
						<span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Accelerometer Linechart</span>
						<LineGraph
							series={[
								{ label: "accelX", color: "#38bdf8", data: accelX },
								{ label: "accelY", color: "#f472b6", data: accelY },
								{ label: "accelZ", color: "#34d399", data: accelZ },
							]}
							scale={1.2}
							yAutoscaleMin={-12}
							yAutoscaleMax={12}
							maxXinFrame={15}
							xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
							yAxis={{ label: "Accel", unit: "m/s²", tickInterval: 2, labelEvery: 2 }}
						/>
					</Card>

					<Card className="p-3 flex flex-col gap-2">
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
					</Card>

					<Card className="p-3 flex flex-col gap-2">
						<span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Barometer Linechart</span>
						<LineGraph
							series={[
								{ label: "baro", color: "#38bdf8", data: pressure },
							]}
							scale={1.2}
							yAutoscaleMin={950}
							yAutoscaleMax={1050}
							maxXinFrame={15}
							xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
							yAxis={{ label: "Baro", unit: "hPa", tickInterval: 50, labelEvery: 1 }}
						/>
					</Card>
				</div>

				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pointer-events-none ml-auto">
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Accummulated Rotation</span>
						<div className="flex gap-2">
							<Input type="number" value={plannedRotationX} onChange={e => setPlannedRotationX(e.target.value)} placeholder="Roll rad" disabled={!connected} className="w-1/3" />
							<Input type="number" value={plannedRotationY} onChange={e => setPlannedRotationY(e.target.value)} placeholder="Pitch rad" disabled={!connected} className="w-1/3" />
							<Input type="number" value={plannedRotationZ} onChange={e => setPlannedRotationZ(e.target.value)} placeholder="Yaw rad" disabled={!connected} className="w-1/3" />
						</div>
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => setRotation(Number(plannedRotationX), Number(plannedRotationY), Number(plannedRotationZ)))}>Set Rotation</Button>
					</Card>
					
					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Set Gimbal Position</span>
						<div className="flex gap-2">
							<Input type="number" value={plannedGimbalX} onChange={e => setPlannedGimbalX(e.target.value)} placeholder="X deg" disabled={!connected} className="w-1/2" />
							<Input type="number" value={plannedGimbalY} onChange={e => setPlannedGimbalY(e.target.value)} placeholder="Y deg" disabled={!connected} className="w-1/2" />
						</div>
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => setGimbalPos(Number(plannedGimbalX), Number(plannedGimbalY)))}>Send Gimbal</Button>
					</Card>

					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Buzzer</span>
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(beepBuzzer)}>Beep Buzzer</Button>
					</Card>

					<Card className="p-3 flex flex-col gap-2">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-red-300" : "text-red-300/40"}`}>Fire Pyro Channel</span>
						<Input type="number" min="0" value={plannedChannel} onChange={e => setPlannedChannel(e.target.value)} disabled={!connected} />
						<Button variant="danger" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => firePyroChanel(Number(plannedChannel)))}>Fire Channel</Button>
					</Card>

					{commandError &&
					<Card variant="error" className="p-3 flex flex-col gap-2">
						<span className="text-xs text-red-400 break-all">{commandError}</span>
					</Card>
					}
				</div>
			</div>
		</div>
	);
}
