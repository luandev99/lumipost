"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Halo radial em textura — um plano com cor chapada deixa a borda reta
 * aparecendo sobre o fundo escuro.
 */
export function useRadialGlow(
  core = "rgba(180,130,255,0.95)",
  mid = "rgba(124,58,237,0.38)",
) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, core);
      gradient.addColorStop(0.4, mid);
      gradient.addColorStop(1, "rgba(124,58,237,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [core, mid]);
}
