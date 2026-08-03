"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { useState } from "react";
import WaveBackground from "./WaveBackground";
import Starfield from "./Starfield";
import FloatingCards from "./FloatingCards";

export default function HeroCanvas() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 60 }}
      style={{ pointerEvents: "none" }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(2)}
        onDecline={() => setDpr(1)}
      />
      <AdaptiveDpr pixelated={false} />
      <ambientLight intensity={0.6} />
      <Suspense fallback={null}>
        <WaveBackground intensity={0.95} />
        <Starfield count={380} />
        <FloatingCards />
      </Suspense>
    </Canvas>
  );
}
