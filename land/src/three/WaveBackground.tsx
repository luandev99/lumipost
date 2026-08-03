"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Campo de ondas com domain warping (fbm) — gera as faixas de luz violeta
 * que atravessam o hero, no espírito do gradiente da marca.
 */
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uMouse;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    p += uMouse * 0.16;

    float t = uTime * 0.045;

    vec2 q = vec2(fbm(p * 1.25 + t), fbm(p * 1.25 + vec2(3.2, 1.7) - t));
    vec2 r = vec2(
      fbm(p * 1.05 + 2.0 * q + vec2(1.7, 9.2) + t * 1.5),
      fbm(p * 1.05 + 2.0 * q + vec2(8.3, 2.8) - t * 1.3)
    );
    float f = fbm(p + 2.3 * r);

    // faixas sedosas seguindo o warp
    float bands = abs(sin((f * 5.5 + p.y * 1.6 + t * 2.6) * 3.14159));
    bands = pow(1.0 - bands, 7.0);

    vec3 deep = vec3(0.016, 0.014, 0.028);
    vec3 violet = vec3(0.30, 0.13, 0.70);
    vec3 lilac = vec3(0.72, 0.49, 1.00);

    vec3 col = mix(deep, violet, smoothstep(0.22, 0.95, f));
    col = mix(col, lilac, bands * 0.85 * smoothstep(0.18, 0.9, f));
    col += vec3(0.30, 0.15, 0.62) * pow(f, 3.0) * 0.7;

    // poeira estelar fina
    float sparkle = pow(hash(floor((vUv + t * 0.02) * 900.0)), 42.0);
    col += vec3(0.85, 0.72, 1.0) * sparkle * 0.9;

    float vig = smoothstep(1.65, 0.15, length(p * vec2(0.62, 1.0)));
    float alpha = clamp(vig * uIntensity, 0.0, 1.0);

    gl_FragColor = vec4(col * vig, alpha);
  }
`;

export default function WaveBackground({ intensity = 1 }: { intensity?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uIntensity: { value: intensity },
    }),
    [intensity],
  );

  const pointerTarget = useRef(new THREE.Vector2());

  useFrame((state, delta) => {
    if (!material.current) return;
    const live = material.current.uniforms;
    live.uTime.value += delta;
    live.uAspect.value = size.width / size.height;
    pointerTarget.current.set(state.pointer.x, state.pointer.y);
    (live.uMouse.value as THREE.Vector2).lerp(pointerTarget.current, 0.03);
  });

  return (
    <mesh position={[0, 0, -6]} scale={[viewport.width * 2.4, viewport.height * 2.4, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
