import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";

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
    <group scale={10} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function SceneBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas camera={{ position: [3.5, 2.2, 5], fov: 42 }} shadows dpr={[1, 2]}>
        <color attach="background" args={["#050816"]} />
        <fog attach="fog" args={["#050816", 6, 16]} />

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

        <ModelErrorBoundary>
          <Suspense fallback={null}>
            <ExportedRocket />
          </Suspense>
        </ModelErrorBoundary>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}
