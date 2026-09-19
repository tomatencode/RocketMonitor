import { useEffect, useMemo, useRef } from "react";
import { Object3D, SpotLight } from "three";

interface GroundSpotlightProps {
  position: [number, number, number];
  intensity: number;
  target: [number, number, number];
}

// Reused scratch object to derive a roll-free "look at the target" rotation for the housing.
const lookAtHelper = new Object3D();

export function GroundSpotlight({ position, intensity, target }: GroundSpotlightProps) {
  const lightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  const rotation = useMemo<[number, number, number]>(() => {
    lookAtHelper.position.set(...position);
    lookAtHelper.lookAt(...target);
    return [lookAtHelper.rotation.x, lookAtHelper.rotation.y, lookAtHelper.rotation.z];
  }, [position, target]);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  return (
    <>
      <group position={position} rotation={rotation}>
        <mesh castShadow>
          <boxGeometry args={[0.02, 0.02, 0.04]} />
          <meshStandardMaterial color="#222225" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      <spotLight
        ref={lightRef}
        position={position}
        intensity={intensity}
        angle={0.3}
        penumbra={0.6}
        castShadow
      />
      <object3D ref={targetRef} position={target} />
    </>
  );
}
