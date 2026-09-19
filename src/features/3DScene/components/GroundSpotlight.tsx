import { useEffect, useMemo, useRef } from "react";
import { Object3D, SpotLight as SpotLightImpl } from "three";
import { SpotLight } from "@react-three/drei";

interface GroundSpotlightProps {
  position: [number, number, number];
  intensity: number;
  target: [number, number, number];
}

// Reused scratch object to derive a roll-free "look at the target" rotation for the housing.
const lookAtHelper = new Object3D();

export function GroundSpotlight({ position, intensity, target }: GroundSpotlightProps) {
  const lightRef = useRef<SpotLightImpl>(null);
  const targetRef = useRef<Object3D>(null);

  const rotation = useMemo<[number, number, number]>(() => {
    lookAtHelper.position.set(...position);
    lookAtHelper.lookAt(...target);
    return [lookAtHelper.rotation.x, lookAtHelper.rotation.y, lookAtHelper.rotation.z];
  }, [position, target]);

  // The beam extends twice as far as the target and fades out over that length (via opacity/attenuation).
  const beamDistance = useMemo(
    () => 2 * Math.hypot(target[0] - position[0], target[1] - position[1], target[2] - position[2]),
    [position, target]
  );

  const spotAngle = 0.3;
  // Match the cone's radius to the real light's angle instead of drei's default (angle * 7), which is
  // tuned for much longer beams and made ours look like a short, flared disc.
  const beamRadiusBottom = beamDistance * Math.tan(spotAngle);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  return (
    <>
      <group position={position} rotation={rotation}>
        <mesh castShadow>
          <boxGeometry args={[0.02, 0.02, 0.03]} />
          <meshStandardMaterial color="#222225" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      <SpotLight
        ref={lightRef}
        position={position}
        intensity={intensity}
        angle={spotAngle}
        penumbra={0.6}
        castShadow
        volumetric
        opacity={intensity / 2}
        attenuation={beamDistance}
        anglePower={4}
        distance={beamDistance}
        radiusTop={0.005}
        radiusBottom={beamRadiusBottom}
        color="#b8c6df"
      />
      <object3D ref={targetRef} position={target} />
    </>
  );
}
