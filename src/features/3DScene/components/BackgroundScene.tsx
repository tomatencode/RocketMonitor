import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { PolarGround } from "./PolarGround";
import { RocketModel } from "./RocketModel";

const MIN_CAMERA_HEIGHT = 0.15;

export default function BackgroundScene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  // The distance the user actually dialed in via zoom, independent of any ground clamping applied below.
  const desiredDistanceRef = useRef<number | null>(null);
  const appliedDistanceRef = useRef<number | null>(null);

  function handleControlsChange(event?: { target: OrbitControlsImpl }) {
    const controls = event?.target ?? controlsRef.current;
    if (!controls) return;

    const { object: camera, target } = controls;
    const rawDistance = camera.position.distanceTo(target);

    if (desiredDistanceRef.current === null) {
      desiredDistanceRef.current = rawDistance;
    } else if (appliedDistanceRef.current) {
      // Scale by the ratio of this frame's change so zoom deltas apply on top of the true desired distance, not the (possibly clamped) applied one.
      desiredDistanceRef.current *= rawDistance / appliedDistanceRef.current;
    }
    desiredDistanceRef.current = Math.min(Math.max(desiredDistanceRef.current, controls.minDistance), controls.maxDistance);

    const direction = camera.position.clone().sub(target).normalize();
    let effectiveDistance = desiredDistanceRef.current;
    if (direction.y < 0) {
      const maxAllowedDistance = (MIN_CAMERA_HEIGHT - target.y) / direction.y;
      effectiveDistance = Math.min(effectiveDistance, maxAllowedDistance);
    }

    camera.position.copy(target).addScaledVector(direction, effectiveDistance);
    appliedDistanceRef.current = effectiveDistance;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas camera={{ position: [5, 3.5, 5], fov: 60 }} shadows dpr={[1, 2]}>
        <color attach="background" args={["#060606"]} />
        <fog attach="fog" args={["#060606", 50, 200]} />

        <ambientLight intensity={0.8} />
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
          maxPolarAngle={Math.PI - 0.05}
          onChange={handleControlsChange}
        />
      </Canvas>
    </div>
  );
}
