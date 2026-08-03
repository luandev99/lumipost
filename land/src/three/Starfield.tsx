"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aScale;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.28 + aSeed * 6.28) * 0.35;
    pos.x += cos(uTime * 0.2 + aSeed * 4.1) * 0.28;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aScale * (24.0 / -mvPosition.z);

    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.4 + aSeed * 12.0));
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 2.4);
    gl_FragColor = vec4(uColor, glow * vAlpha);
  }
`;

/** PRNG determinístico — mesma distribuição no servidor e no cliente. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Starfield({
  count = 420,
  radius = 13,
  color = "#c9a6ff",
  seed = 20260801,
}: {
  count?: number;
  radius?: number;
  color?: string;
  seed?: number;
}) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

  const { positions, scales, seeds } = useMemo(() => {
    const random = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const r = radius * (0.35 + random() * 0.65);
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.45 - 2;
      scales[i] = 0.4 + random() * 1.9;
      seeds[i] = random();
    }

    return { positions, scales, seeds };
  }, [count, radius, seed]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 5.5 },
      uColor: { value: new THREE.Color(color) },
    }),
    [color],
  );

  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta;
    if (points.current) points.current.rotation.y += delta * 0.012;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
