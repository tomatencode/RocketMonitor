import { Canvas } from "@react-three/fiber";
import { Environment, Float, OrbitControls } from "@react-three/drei";

function RocketModel() {
  return (
    <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.8}>
      <group position={[0, 0.1, 0]}>
        <mesh castShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.42, 2.6, 8, 18]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.18} />
        </mesh>

        <mesh castShadow position={[0, 1.9, 0]}>
          <coneGeometry args={[0.3, 0.9, 20]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.75} roughness={0.25} />
        </mesh>

        <mesh castShadow position={[0, -1.75, 0]}>
          <coneGeometry args={[0.45, 0.7, 20]} />
          <meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.4} metalness={0.35} roughness={0.2} />
        </mesh>

        <mesh castShadow position={[0, 0.75, 0.46]}>
          <boxGeometry args={[0.18, 0.8, 0.18]} />
          <meshStandardMaterial color="#a5b4fc" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    </Float>
  );
}

function LaunchPad() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.8, 0]} receiveShadow>
      <circleGeometry args={[6, 64]} />
      <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.9} />
    </mesh>
  );
}

export default function SceneBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas camera={{ position: [3.5, 2.2, 5], fov: 42 }} shadows dpr={[1, 2]}>
        <color attach="background" args={["#050816"]} />
        <fog attach="fog" args={["#050816", 6, 16]} />

        <ambientLight intensity={0.8} />
        <directionalLight
          castShadow
          position={[4, 6, 3]}
          intensity={2.2}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight position={[-3, 4, 2]} intensity={0.9} angle={0.5} penumbra={0.8} />

        <Environment preset="night" />

        <LaunchPad />
        <RocketModel />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.45}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}
