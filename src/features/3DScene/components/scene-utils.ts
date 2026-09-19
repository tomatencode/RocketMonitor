export type Point3 = [number, number, number];

export function createCirclePoints(radius: number): Point3[] {
  return Array.from({ length: 65 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2;

    return [
      Math.cos(angle) * radius,
      0.003,
      Math.sin(angle) * radius,
    ];
  });
}

export function createSpokePoints(angle: number, radius: number): Point3[] {
  return [
    [0, 0.003, 0],
    [Math.cos(angle) * radius, 0.003, Math.sin(angle) * radius],
  ];
}

export function createRingRadii(maxRadius: number, growthFactor = 1.3, minStep = 0.08) {
  const radii: number[] = [];
  let radius = minStep;
  let step = minStep;

  while (radius <= maxRadius) {
    radii.push(Math.round(radius * 1000) / 1000);
    step *= growthFactor;
    radius += step;
  }

  return radii;
}
