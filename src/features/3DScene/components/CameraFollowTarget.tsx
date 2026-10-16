import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";

interface CameraFollowTargetProps {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  target: [number, number, number];
}

// Move the camera and orbit target together so position updates preserve the current view angle.
export function CameraFollowTarget({ controlsRef, target }: CameraFollowTargetProps) {
  const previousTarget = useRef<Vector3 | null>(null);
  const nextTarget = useRef(new Vector3());
  const movement = useRef(new Vector3());

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    nextTarget.current.set(...target);
    if (previousTarget.current === null) {
      previousTarget.current = nextTarget.current.clone();
      controls.target.copy(nextTarget.current);
      controls.update();
      return;
    }

    movement.current.subVectors(nextTarget.current, previousTarget.current);
    if (movement.current.lengthSq() === 0) return;

    controls.object.position.add(movement.current);
    controls.target.copy(nextTarget.current);
    previousTarget.current.copy(nextTarget.current);
    controls.update();
  });

  return null;
}
