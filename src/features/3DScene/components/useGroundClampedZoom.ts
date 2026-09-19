import { useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const MIN_CAMERA_HEIGHT = 0.15;
// How quickly the camera eases back out toward the desired distance once the ground clamp releases.
const UNCLAMP_SMOOTHING = 0.15;

// Keeps the orbit camera from dipping below the ground while still remembering the
// user's actual desired zoom distance, so it can smoothly resume once unclamped.
export function useGroundClampedZoom() {
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

    // Ease toward the target instead of snapping, so releasing the ground clamp doesn't cause a sudden jump.
    if (appliedDistanceRef.current !== null && effectiveDistance > appliedDistanceRef.current) {
      effectiveDistance =
        appliedDistanceRef.current + (effectiveDistance - appliedDistanceRef.current) * UNCLAMP_SMOOTHING;
    }

    camera.position.copy(target).addScaledVector(direction, effectiveDistance);
    appliedDistanceRef.current = effectiveDistance;
  }

  return { controlsRef, handleControlsChange };
}
