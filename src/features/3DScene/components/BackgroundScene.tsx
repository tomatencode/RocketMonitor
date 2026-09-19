import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

import { PolarGround } from "./PolarGround";
import { RocketModel } from "./RocketModel";
import { useGroundClampedZoom } from "./useGroundClampedZoom";

export default function BackgroundScene() {
  const { controlsRef, handleControlsChange } = useGroundClampedZoom();

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas camera={{ position: [5, 3.5, 5], fov: 60 }} shadows dpr={[1, 2]}>
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
        <RocketModel />

        <OrbitControls
          ref={controlsRef}
          target={[0, 2, 0]}
          enablePan={true}
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
