"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Environment,
  Lightformer,
  PerformanceMonitor,
} from "@react-three/drei";
import * as THREE from "three";
import Phone from "./Phone";
import Starfield from "./Starfield";
import { productScroll } from "./scrollState";
import { useCanvasTexture } from "./useCanvasTexture";
import { useRadialGlow } from "./glow";
import { CARD_H, CARD_W, drawCard, type CardId } from "@/lib/cardTexture";

const RATIO = CARD_W / CARD_H;

function OrbitCard({
  id,
  angle,
  radius,
  height,
  scale,
}: {
  id: CardId;
  angle: number;
  radius: number;
  height: number;
  scale: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const draw = useCallback(
    (canvas: HTMLCanvasElement) => drawCard(canvas, id),
    [id],
  );
  const texture = useCanvasTexture(CARD_W, CARD_H, draw);
  const glow = useRadialGlow();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.13 + angle;
    const spread = 1 + productScroll.progress * 0.28;
    // a excursão em z mantém os cards sempre atrás do aparelho
    ref.current.position.set(
      Math.cos(t) * radius * spread,
      height + Math.sin(t * 1.6) * 0.16,
      Math.sin(t) * radius * 0.32 - 2.3,
    );
    ref.current.rotation.y = -t + Math.PI / 2;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.06;
  });

  return (
    <group ref={ref} scale={scale}>
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[1.7 * RATIO * 2.6, 1.7 * 2.1]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[1.7 * RATIO, 1.7]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** No desktop o aparelho fica à direita; no mobile, centralizado e mais alto. */
function SceneShift({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  const wide = size.width >= 1024;
  return (
    <group position={wide ? [1.45, 0, 0] : [0, 0.82, 0]}>{children}</group>
  );
}

/** Câmera com leve parallax de mouse e um empurrão conforme o scroll. */
function Rig() {
  useFrame((state, delta) => {
    const damp = 1 - Math.pow(0.0015, delta);
    const targetX = state.pointer.x * 0.42;
    const targetY = 0.18 + state.pointer.y * 0.26;
    const targetZ = 7.2 - productScroll.progress * 0.9;

    state.camera.position.x += (targetX - state.camera.position.x) * damp;
    state.camera.position.y += (targetY - state.camera.position.y) * damp;
    state.camera.position.z += (targetZ - state.camera.position.z) * damp;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function PhoneCanvas() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.18, 7.2], fov: 38, near: 0.1, far: 40 }}
      style={{ pointerEvents: "none" }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(2)}
        onDecline={() => setDpr(1)}
      />
      <AdaptiveDpr pixelated={false} />

      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 4]} intensity={22} color="#c9a6ff" />
      <pointLight position={[-5, -2, 3]} intensity={16} color="#7c3aed" />
      <spotLight
        position={[0, 6, 5]}
        angle={0.5}
        penumbra={1}
        intensity={28}
        color="#ffffff"
      />

      <Suspense fallback={null}>
        <Environment resolution={256} frames={1}>
          <Lightformer
            form="rect"
            intensity={3}
            color="#a970ff"
            position={[-4, 2, 3]}
            scale={[7, 7, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            color="#ffffff"
            position={[4, -1, 2]}
            scale={[5, 8, 1]}
          />
          <Lightformer
            form="circle"
            intensity={2.4}
            color="#7c3aed"
            position={[0, 5, -4]}
            scale={[9, 9, 1]}
          />
        </Environment>

        <Starfield count={220} radius={11} color="#b9a0ff" />
        <SceneShift>
          <OrbitCard id="carrossel" angle={0} radius={3.5} height={0.9} scale={0.5} />
          <OrbitCard id="agenda" angle={2.4} radius={3.9} height={-0.85} scale={0.45} />
          <OrbitCard id="story" angle={4.3} radius={3.3} height={0.25} scale={0.42} />
          <Phone />
        </SceneShift>
        <Rig />
      </Suspense>
    </Canvas>
  );
}
