import { Line } from "@react-three/drei";

import { createCirclePoints, createRingRadii, createSpokePoints } from "./scene-utils";

export function PolarGround() {
  const size = 20;

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
