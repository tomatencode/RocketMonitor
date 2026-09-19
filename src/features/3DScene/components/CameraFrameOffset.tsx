import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";

interface CameraFrameOffsetProps {
  // Fraction of the viewport height to shift the look-at target above the screen's vertical center.
  verticalOffset: number;
}

// Perspective cameras always center whatever they look at, so shifting the target on screen
// requires an off-axis (shifted) projection rather than moving the target itself.
export function CameraFrameOffset({ verticalOffset }: CameraFrameOffsetProps) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);

  useEffect(() => {
    camera.setViewOffset(size.width, size.height, 0, verticalOffset * size.height, size.width, size.height);
    return () => camera.clearViewOffset();
  }, [camera, size, verticalOffset]);

  return null;
}
