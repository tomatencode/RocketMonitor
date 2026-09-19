import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";

import rocketUrl from "../../../assets/3d/rocket/Rocket.glb?url";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

function ExportedRocket() {
  const { scene } = useGLTF(rocketUrl);

  return (
    <group scale={10} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.75, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export function RocketModel() {
  return (
    <ModelErrorBoundary>
      <Suspense fallback={null}>
        <ExportedRocket />
      </Suspense>
    </ModelErrorBoundary>
  );
}
