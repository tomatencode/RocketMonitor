import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";

import rocketUrl from "../../../assets/3d/rocket/Rocket.glb?url";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

interface RocketModelProps {
  position: [number, number, number];
  rotation: [number, number, number];
}

function ExportedRocket() {
  const { scene } = useGLTF(rocketUrl);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export function RocketModel({ position, rotation }: RocketModelProps) {
  return (
    <ModelErrorBoundary>
      <Suspense fallback={null}>
        <group position={position} rotation={rotation}>
          <ExportedRocket />
        </group>
      </Suspense>
    </ModelErrorBoundary>
  );
}
