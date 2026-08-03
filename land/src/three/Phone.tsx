"use client";

import { useEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  SCREEN_H,
  SCREEN_W,
  drawScreen,
  type ScreenId,
} from "@/lib/screenTexture";
import { productScroll, stepFromProgress } from "./scrollState";
import { useRadialGlow } from "./glow";

const SCREENS: ScreenId[] = ["identidade", "plano", "aprovacao", "publicacao"];

const BODY_W = 1.72;
const BODY_H = 3.58;
const BODY_D = 0.2;
const SCREEN_PLANE_W = 1.58;
const SCREEN_PLANE_H = 3.42;

/** Poses do aparelho em cada etapa — interpoladas com suavização. */
const POSES = [
  { ry: 0.62, rx: -0.07, rz: 0.06, y: -0.06, z: 0, s: 1.0 },
  { ry: -0.16, rx: 0.05, rz: -0.04, y: 0.06, z: 0.2, s: 1.01 },
  { ry: 0.34, rx: -0.03, rz: 0.07, y: -0.02, z: 0.1, s: 1.02 },
  { ry: -0.58, rx: 0.07, rz: -0.06, y: 0.05, z: -0.1, s: 0.98 },
];


const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const screenFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;
  varying vec2 vUv;

  void main() {
    vec4 a = texture2D(uTexA, vUv);
    vec4 b = texture2D(uTexB, vUv);

    float feather = 0.2;
    float w = uMix * (1.0 + 2.0 * feather) - feather;
    float x = 1.0 - vUv.y;
    float edge = smoothstep(w - feather, w + feather, x);

    vec4 color = mix(b, a, edge);
    color.rgb *= 1.32; // a tela é a fonte de luz da cena

    // linha de luz na transição ('active' é palavra reservada em GLSL)
    float moving = step(0.002, uMix) * step(uMix, 0.998);
    float streak = exp(-pow((x - w) / (feather * 0.55), 2.0));
    color.rgb += vec3(0.72, 0.52, 1.0) * streak * 0.55 * moving;
    color.a = max(color.a, streak * 0.5 * moving * a.a);

    gl_FragColor = color;
  }
`;

function useScreenTextures() {
  const textures = useMemo(() => {
    return SCREENS.map((id) => {
      const canvas = document.createElement("canvas");
      canvas.width = SCREEN_W;
      canvas.height = SCREEN_H;
      drawScreen(canvas, id);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.userData.canvas = canvas;
      texture.userData.id = id;
      return texture;
    });
  }, []);

  // redesenha quando a fonte real terminar de carregar
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (cancelled) return;
        textures.forEach((texture) => {
          drawScreen(
            texture.userData.canvas as HTMLCanvasElement,
            texture.userData.id as ScreenId,
          );
          texture.needsUpdate = true;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [textures]);

  useEffect(
    () => () => textures.forEach((texture) => texture.dispose()),
    [textures],
  );

  return textures;
}

export default function Phone() {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const { size } = useThree();
  const textures = useScreenTextures();
  const glowTexture = useRadialGlow();

  // Estado da transição vive num ref; os uniforms são escritos pelo material,
  // sempre fora do ciclo de render do React.
  const screen = useRef<THREE.ShaderMaterial>(null);
  const status = useRef({ current: 0, pending: 0, mix: 0 });

  const uniforms = useMemo(
    () => ({
      uTexA: { value: textures[0] },
      uTexB: { value: textures[0] },
      uMix: { value: 0 },
    }),
    [textures],
  );

  useFrame((state, delta) => {
    const p = THREE.MathUtils.clamp(productScroll.progress, 0, 1);

    /* ---------------------------- pose do aparelho --------------------------- */
    const t = THREE.MathUtils.clamp(p * POSES.length - 0.5, 0, POSES.length - 1);
    const index = Math.min(POSES.length - 2, Math.floor(t));
    const local = THREE.MathUtils.clamp(t - index, 0, 1);
    const eased = local * local * local * (local * (local * 6 - 15) + 10);

    const from = POSES[index];
    const to = POSES[index + 1];
    const lerp = THREE.MathUtils.lerp;

    if (group.current) {
      const idle = state.clock.elapsedTime;
      group.current.rotation.y =
        lerp(from.ry, to.ry, eased) + Math.sin(idle * 0.45) * 0.035;
      group.current.rotation.x =
        lerp(from.rx, to.rx, eased) + Math.sin(idle * 0.33) * 0.02;
      group.current.rotation.z = lerp(from.rz, to.rz, eased);
      group.current.position.y =
        lerp(from.y, to.y, eased) + Math.sin(idle * 0.6) * 0.045;
      group.current.position.z = lerp(from.z, to.z, eased);

      const base = size.width < 780 ? 0.56 : size.width < 1200 ? 0.88 : 1;
      const scale = lerp(from.s, to.s, eased) * base;
      group.current.scale.setScalar(scale);
    }

    if (glow.current) {
      const material = glow.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.26 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    }

    /* ----------------------------- troca de tela ---------------------------- */
    if (!screen.current) return;
    const live = screen.current.uniforms;
    const step = status.current;
    const desired = stepFromProgress(p);

    if (step.mix === 0 && desired !== step.current) {
      step.pending = desired;
      live.uTexB.value = textures[desired];
    }

    if (step.pending !== step.current) {
      step.mix = Math.min(1, step.mix + delta * 2.4);
      live.uMix.value = step.mix;
      if (step.mix >= 1) {
        step.current = step.pending;
        step.mix = 0;
        live.uMix.value = 0;
        live.uTexA.value = textures[step.current];
      }
    }
  });

  return (
    <group ref={group}>
      {/* brilho da tela projetado para trás */}
      <mesh ref={glow} position={[0, 0, -0.4]}>
        <planeGeometry args={[BODY_W * 3.4, BODY_H * 1.9]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* corpo */}
      <RoundedBox
        args={[BODY_W, BODY_H, BODY_D]}
        radius={0.22}
        smoothness={8}
        creaseAngle={0.5}
      >
        <meshPhysicalMaterial
          color="#111114"
          metalness={0.92}
          roughness={0.24}
          clearcoat={0.7}
          clearcoatRoughness={0.22}
          envMapIntensity={1.5}
        />
      </RoundedBox>

      {/* borda de luz da marca */}
      <RoundedBox
        args={[BODY_W + 0.035, BODY_H + 0.035, BODY_D - 0.03]}
        radius={0.235}
        smoothness={6}
        creaseAngle={0.5}
      >
        <meshBasicMaterial
          color="#a970ff"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </RoundedBox>

      {/* tela */}
      <mesh position={[0, 0, BODY_D / 2 + 0.002]}>
        <planeGeometry args={[SCREEN_PLANE_W, SCREEN_PLANE_H]} />
        <shaderMaterial
          ref={screen}
          uniforms={uniforms}
          vertexShader={screenVertex}
          fragmentShader={screenFragment}
          transparent
          toneMapped={false}
        />
      </mesh>

      {/* reflexo de vidro */}
      <mesh position={[0, 0, BODY_D / 2 + 0.006]} rotation={[0, 0, -0.32]}>
        <planeGeometry args={[0.5, 4.4]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.045}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* botões laterais */}
      <mesh position={[BODY_W / 2 + 0.005, 0.55, 0]}>
        <boxGeometry args={[0.02, 0.42, 0.09]} />
        <meshStandardMaterial color="#2a2a31" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[-BODY_W / 2 - 0.005, 0.78, 0]}>
        <boxGeometry args={[0.02, 0.26, 0.09]} />
        <meshStandardMaterial color="#2a2a31" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  );
}
