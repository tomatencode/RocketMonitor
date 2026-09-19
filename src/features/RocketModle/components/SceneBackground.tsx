import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Line, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import rocketUrl from "../../../assets/3d/rocket/Rocket.glb?url";

// Prevents a GLTF load/parse failure from crashing the whole app (root has no boundary).
class ModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Failed to load rocket model", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ExportedRocket() {
  const { scene } = useGLTF(rocketUrl);

  return (
    <group scale={10} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.75, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function createCirclePoints(radius: number) {
  return Array.from({ length: 65 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2;

    return [
      Math.cos(angle) * radius,
      0.03,
      Math.sin(angle) * radius,
    ] as [number, number, number];
  });
}

function createSpokePoints(angle: number, radius: number) {
  return [
    [0, 0.03, 0],
    [Math.cos(angle) * radius, 0.03, Math.sin(angle) * radius],
  ] as [number, number, number][];
}

// Generates ring radii with growing spacing (dense near center, sparse at the edge) up to maxRadius.
function createRingRadii(maxRadius: number, growthFactor = 1.3, minStep = 0.8) {
  const radii: number[] = [];
  let radius = minStep;
  let step = minStep;

  while (radius <= maxRadius) {
    radii.push(Math.round(radius * 10) / 10);
    step *= growthFactor;
    radius += step;
  }

  return radii;
}

function PolarGround() {
  const size = 200;

  const ringRadii = createRingRadii(size);
  const ringColors = ["#38bdf8", "#52525b", "#34d399", "#52525b", "#f472b6", "#52525b"];
  const spokeColors = ["#38bdf8", "#52525b", "#34d399", "#52525b"];

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[size * 2.5, size * 2.5]} />
        <meshStandardMaterial color="#111113" roughness={0.96} metalness={0.05} />
      </mesh>

      {ringRadii.map((radius, index) => (
        <Line
          key={radius}
          points={createCirclePoints(radius)}
          color={ringColors[index % ringColors.length]}
          lineWidth={0.65}
          transparent
          opacity={index % 2 === 0 ? 0.34 : 0.24}
          fog
        />
      ))}

      {Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;

        return (
          <Line
            key={angle}
            points={createSpokePoints(angle, size)}
            color={spokeColors[index % spokeColors.length]}
            lineWidth={0.55}
            transparent
            opacity={index % 4 === 0 ? 0.3 : 0.18}
            fog
          />
        );
      })}
    </>
  );
}

const MIN_CAMERA_HEIGHT = 0.15;

export default function SceneBackground() {
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

        <ModelErrorBoundary>
          <Suspense fallback={null}>
            <ExportedRocket />
          </Suspense>
        </ModelErrorBoundary>

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
