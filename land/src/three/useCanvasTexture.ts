"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/**
 * Cria uma CanvasTexture a partir de uma função de desenho.
 * A textura é refeita quando as fontes terminam de carregar — antes disso o
 * canvas pintaria o texto com a fonte de fallback.
 */
export function useCanvasTexture(
  width: number,
  height: number,
  draw: (canvas: HTMLCanvasElement) => void,
) {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) setFontsReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas);

    const created = new THREE.CanvasTexture(canvas);
    created.colorSpace = THREE.SRGBColorSpace;
    created.anisotropy = 8;
    return created;
    // `fontsReady` é dependência de propósito: força repintar com a fonte real
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, draw, fontsReady]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
