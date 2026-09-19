import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

import { PolarGround } from "./PolarGround";
import { RocketModel } from "./RocketModel";
import { useGroundClampedZoom } from "./useGroundClampedZoom";

interface BackgroundSceneProps {
  RocketPosition: [number, number, number];
  RocketRotation: [number, number, number];
}

export default function BackgroundScene({ RocketPosition, RocketRotation }: BackgroundSceneProps) {
  const { controlsRef, handleControlsChange } = useGroundClampedZoom();

  const cameraPositionOffset: [number, number, number] = [5, 2.5, 5];
  const cameraPosition: [number, number, number] = [
    RocketPosition[0] + cameraPositionOffset[0],
    RocketPosition[1] + cameraPositionOffset[1],
    RocketPosition[2] + cameraPositionOffset[2]
  ];

  const targetOffset: [number, number, number] = [0, 1, 0];
  const target: [number, number, number] = [
    RocketPosition[0] + targetOffset[0],
    RocketPosition[1] + targetOffset[1],
    RocketPosition[2] + targetOffset[2]
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas camera={{ position: cameraPosition, fov: 60 }} shadows dpr={[1, 2]}>
        <color attach="background" args={["#060606"]} />
        <fog attach="fog" args={["#060606", 50, 200]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[4, 6, 3]}
          intensity={1.0}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight position={[-3, 4, 2]} intensity={0.9} angle={0.5} penumbra={0.8} />

        <Environment preset="night" />
        <PolarGround />
        <RocketModel position={RocketPosition} rotation={RocketRotation} />

        <OrbitControls
          ref={controlsRef}
          target={target}
          enablePan={false}
          enableZoom={true}
          autoRotate
          autoRotateSpeed={0.5}
          minDistance={2}
          maxDistance={20}
          minPolarAngle={0}
          maxPolarAngle={Math.PI - 0.5}
          onChange={handleControlsChange}
        />
      </Canvas>
    </div>
  );
}
