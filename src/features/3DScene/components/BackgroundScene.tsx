import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

import { PolarGround } from "./PolarGround";
import { RocketModel } from "./RocketModel";
import { GroundSpotlight } from "./GroundSpotlight";
import { useGroundClampedZoom } from "./useGroundClampedZoom";

const GROUND_SPOTLIGHT_RADIUS = 0.3;
const GROUND_SPOTLIGHT_COUNT = 4;
const GROUND_SPOTLIGHT_ANGLE_OFFSET = Math.PI / 8;
const GROUND_SPOTLIGHT_TARGET: [number, number, number] = [0, 0.2, 0];

const groundSpotlights = Array.from({ length: GROUND_SPOTLIGHT_COUNT }, (_, index) => {
  const angle = (index / GROUND_SPOTLIGHT_COUNT) * Math.PI * 2;
  const position: [number, number, number] = [
    Math.cos(angle + GROUND_SPOTLIGHT_ANGLE_OFFSET) * GROUND_SPOTLIGHT_RADIUS,
    0,
    Math.sin(angle + GROUND_SPOTLIGHT_ANGLE_OFFSET) * GROUND_SPOTLIGHT_RADIUS,
  ];

  return { position };
});

interface BackgroundSceneProps {
  RocketPosition: [number, number, number];
  RocketRotation: [number, number, number];
}

export default function BackgroundScene({ RocketPosition, RocketRotation }: BackgroundSceneProps) {
  const { controlsRef, handleControlsChange } = useGroundClampedZoom();

  const targetOffset: [number, number, number] = [0, 0.1, 0];
  const target: [number, number, number] = [
    RocketPosition[0] + targetOffset[0],
    RocketPosition[1] + targetOffset[1],
    RocketPosition[2] + targetOffset[2]
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas camera={{ position: [0.4, 0.35, 0.4], fov: 60 }} shadows dpr={[1, 2]}>
        <color attach="background" args={["#060606"]} />
        <fog attach="fog" args={["#060606", 5, 20]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[0.4, 1.0, 0.3]}
          intensity={1.2}
          shadow-mapSize-width={2024}
          shadow-mapSize-height={2024}
        />

        <Environment preset="night" />
        <PolarGround />
        <RocketModel position={RocketPosition} rotation={RocketRotation} />

        {groundSpotlights.map((spotlight, index) => (
          <GroundSpotlight
            key={index}
            position={spotlight.position}
            target={GROUND_SPOTLIGHT_TARGET}
            intensity={0.5}
          />
        ))}

        <OrbitControls
          ref={controlsRef}
          target={target}
          enablePan={false}
          enableZoom={true}
          autoRotate
          autoRotateSpeed={0.5}
          minDistance={0.2}
          maxDistance={2}
          minPolarAngle={0}
          maxPolarAngle={Math.PI - 0.5}
          onChange={handleControlsChange}
        />
      </Canvas>
    </div>
  );
}
