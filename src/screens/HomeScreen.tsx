import { useEffect, useState } from "react";
import { useRadioLink } from "../features/RadioLink/RadioLinkContext";
import { Button } from "../shared/components/primitives/Button";
import { Card } from "../shared/components/primitives/Card";
import { Input } from "../shared/components/primitives/Input";
import { LineGraph } from "../shared/components/primitives/LineGraph";
import SceneBackground from "../features/RocketModle/components/SceneBackground";


const ACCEL_SAMPLES_IN_CHART = 10;
const GYRO_SAMPLES_IN_CHART = 10;

export default function HomeScreen() {
	const { connected, setGimbalPos, beepBuzzer, firePyroChanel, getIMU } = useRadioLink();
	const [gimbalX, setGimbalX] = useState("0");
	const [gimbalY, setGimbalY] = useState("0");
	const [channel, setChannel] = useState("1");
	const [error, setError] = useState<string | null>(null);

	const [accelX, setAccelX] = useState<number[]>([]);
	const [accelY, setAccelY] = useState<number[]>([]);
	const [accelZ, setAccelZ] = useState<number[]>([]);
	const [accelSampleCount, setAccelSampleCount] = useState(0);
	const [gyroX, setGyroX] = useState<number[]>([]);
	const [gyroY, setGyroY] = useState<number[]>([]);
	const [gyroZ, setGyroZ] = useState<number[]>([]);
	const [gyroSampleCount, setGyroSampleCount] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			getIMU().then(imu => {
				setAccelX(prev => [...prev.slice(-ACCEL_SAMPLES_IN_CHART), imu.accelX_m_s2]);
				setAccelY(prev => [...prev.slice(-ACCEL_SAMPLES_IN_CHART), imu.accelY_m_s2]);
				setAccelZ(prev => [...prev.slice(-ACCEL_SAMPLES_IN_CHART), imu.accelZ_m_s2]);
				setAccelSampleCount(prev => prev + 1);
				setGyroX(prev => [...prev.slice(-GYRO_SAMPLES_IN_CHART), imu.gyroX_rad_s]);
				setGyroY(prev => [...prev.slice(-GYRO_SAMPLES_IN_CHART), imu.gyroY_rad_s]);
				setGyroZ(prev => [...prev.slice(-GYRO_SAMPLES_IN_CHART), imu.gyroZ_rad_s]);
				setGyroSampleCount(prev => prev + 1);
			});
		}, 500);
		return () => clearInterval(interval);
	}, []);

	async function run(action: () => Promise<void>) {
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(String(e));
		}
	}

	return (
		<div className="relative flex h-full bg-transparent text-zinc-200 font-mono text-sm overflow-hidden p-3 gap-3">
			<SceneBackground />
			<div className="relative z-10 flex flex-row min-h-0 gap-3 overflow-x-auto w-full">
				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
					<span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Accelerometer Linechart</span>
					<Card className="p-3 flex flex-col gap-2 border border-zinc-700/60">
						<LineGraph
							series={[
								{ label: "accelX", color: "#38bdf8", data: accelX },
								{ label: "accelY", color: "#f472b6", data: accelY },
								{ label: "accelZ", color: "#34d399", data: accelZ },
							]}
							scale={1.2}
							yAutoscaleMin={-10}
							yAutoscaleMax={10}
							xOffset={Math.max(0, accelSampleCount - ACCEL_SAMPLES_IN_CHART)}
							xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
							yAxis={{ label: "Accel", unit: "m/s²", tickInterval: 2, labelEvery: 2 }}
						/>
					</Card>

					<span className="text-xs font-semibold tracking-wide uppercase text-zinc-300">Gyroscope Linechart</span>
					<Card className="p-3 flex flex-col gap-2 border border-zinc-700/60">
						<LineGraph
							series={[
								{ label: "gyroX", color: "#38bdf8", data: gyroX },
								{ label: "gyroY", color: "#f472b6", data: gyroY },
								{ label: "gyroZ", color: "#34d399", data: gyroZ },
							]}
							scale={1.2}
							yAutoscaleMin={-5}
							yAutoscaleMax={5}
							xOffset={Math.max(0, gyroSampleCount - GYRO_SAMPLES_IN_CHART)}
							xAxis={{ label: "Time", tickInterval: 2, labelEvery: 0, atZero: true }}
							yAxis={{ label: "Gyro", unit: "rad/s", tickInterval: 1, labelEvery: 2 }}
						/>
					</Card>
				</div>
				<div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
					<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Radio-Link Commands</span>
					<Card className="p-3 flex flex-col gap-2 border border-zinc-700/60">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-zinc-300" : "text-zinc-600"}`}>Set Gimbal Position</span>
						<div className="flex gap-2">
							<Input type="number" value={gimbalX} onChange={e => setGimbalX(e.target.value)} placeholder="X deg" disabled={!connected} className="w-1/2" />
							<Input type="number" value={gimbalY} onChange={e => setGimbalY(e.target.value)} placeholder="Y deg" disabled={!connected} className="w-1/2" />
						</div>
						<Button variant="primary" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => setGimbalPos(Number(gimbalX), Number(gimbalY)))}>Send Gimbal</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2 border border-zinc-700/60">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-yellow-300" : "text-yellow-300/40"}`}>Buzzer</span>
						<Button variant="warning" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(beepBuzzer)}>Beep Buzzer</Button>
					</Card>
					<Card className="p-3 flex flex-col gap-2 border border-zinc-700/60">
						<span className={`text-xs font-semibold tracking-wide uppercase ${connected ? "text-red-300" : "text-red-300/40"}`}>Fire Pyro Channel</span>
						<Input type="number" min="0" value={channel} onChange={e => setChannel(e.target.value)} disabled={!connected} />
						<Button variant="danger" className="px-3 py-1.5 text-xs self-start" disabled={!connected} onClick={() => run(() => firePyroChanel(Number(channel)))}>Fire Channel</Button>
					</Card>
					{error &&
					<Card variant="error" className="p-3 flex flex-col gap-2">
						<span className="text-xs text-red-400 break-all">{error}</span>
					</Card>
					}
				</div>
			</div>
		</div>
	);
}
