"use client";

import { useCallback, useRef } from "react";
import { Float } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CARD_H, CARD_W, drawCard, type CardId } from "@/lib/cardTexture";
import { useCanvasTexture } from "./useCanvasTexture";
import { useRadialGlow } from "./glow";

type CardProps = {
  id: CardId;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  speed?: number;
};

const RATIO = CARD_W / CARD_H;

function ContentCard({ id, position, rotation, scale = 1, speed = 1 }: CardProps) {
  const draw = useCallback(
    (canvas: HTMLCanvasElement) => drawCard(canvas, id),
    [id],
  );
  const texture = useCanvasTexture(CARD_W, CARD_H, draw);
  const glow = useRadialGlow();

  return (
    <Float speed={speed * 1.2} rotationIntensity={0.28} floatIntensity={0.7}>
      <group position={position} rotation={rotation} scale={scale}>
        {/* halo */}
        <mesh position={[0, 0, -0.06]}>
          <planeGeometry args={[1.8 * RATIO * 2.6, 1.8 * 2.1]} />
          <meshBasicMaterial
            map={glow}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[1.8 * RATIO, 1.8]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

/** Posições fora da coluna do título — o texto nunca disputa espaço com os cards. */
const LAYOUT: CardProps[] = [
  { id: "carrossel", position: [3.45, 0.3, -0.4], rotation: [-0.04, -0.4, 0.03], scale: 0.95, speed: 1 },
  { id: "story", position: [5.0, 1.8, -2.1], rotation: [0.02, -0.58, -0.07], scale: 0.7, speed: 1.4 },
  { id: "agenda", position: [2.9, -2.05, -1.5], rotation: [0.06, -0.3, 0.05], scale: 0.68, speed: 0.8 },
  { id: "legenda", position: [-4.05, 0.95, -2.2], rotation: [0.01, 0.5, 0.04], scale: 0.72, speed: 1.15 },
];

export default function FloatingCards() {
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();
  const compact = size.width < 900;

  useFrame((state, delta) => {
    if (!group.current) return;
    const damp = 1 - Math.pow(0.001, delta);
    group.current.rotation.y +=
      (state.pointer.x * 0.16 - group.current.rotation.y) * damp;
    group.current.rotation.x +=
      (-state.pointer.y * 0.1 - group.current.rotation.x) * damp;
  });

  return (
    <group
      ref={group}
      scale={compact ? 0.62 : 1}
      position={compact ? [0.2, -0.4, -2.2] : [0, 0, 0]}
    >
      {LAYOUT.map((card) => (
        <ContentCard key={card.id} {...card} />
      ))}
    </group>
  );
}
