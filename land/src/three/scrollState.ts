/**
 * Ponte sem re-render entre o ScrollTrigger (DOM) e a cena 3D.
 * O ScrollTrigger escreve `progress`; o useFrame lê a cada quadro.
 */
export const productScroll = {
  /** 0 → 1 ao longo da seção fixada. */
  progress: 0,
};

export const STEP_COUNT = 4;

/** Índice da tela ativa a partir do progresso (troca em 0.25 / 0.5 / 0.75). */
export function stepFromProgress(progress: number) {
  return Math.min(
    STEP_COUNT - 1,
    Math.max(0, Math.round(progress * STEP_COUNT - 0.5)),
  );
}
