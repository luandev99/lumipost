/**
 * Mini cards de conteúdo desenhados em canvas — usados como textura
 * dos planos flutuantes do hero 3D.
 */

export const CARD_W = 560;
export const CARD_H = 700;

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

export type CardId = "carrossel" | "story" | "agenda" | "legenda";

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function label(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(value, x, y);
}

function pill(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  color: string,
  bg: string,
) {
  ctx.font = `800 20px ${FONT}`;
  const w = ctx.measureText(value).width + 32;
  rr(ctx, x, y, w, 46, 23);
  ctx.fillStyle = bg;
  ctx.fill();
  label(ctx, value, x + 16, y + 31, 20, 800, color);
}

function lines(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  widths: number[],
  color = "rgba(255,255,255,0.3)",
) {
  widths.forEach((w, i) => {
    rr(ctx, x, y + i * 30, w, 14, 7);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

const painters: Record<CardId, (ctx: CanvasRenderingContext2D) => void> = {
  carrossel(ctx) {
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, "#6d28d9");
    g.addColorStop(0.55, "#3b0764");
    g.addColorStop(1, "#120a24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const glow = ctx.createRadialGradient(150, 120, 20, 150, 120, 460);
    glow.addColorStop(0, "rgba(201,166,255,0.55)");
    glow.addColorStop(1, "rgba(201,166,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    pill(ctx, "CARROSSEL", 44, 44, "#f5edff", "rgba(0,0,0,0.28)");
    label(ctx, "5 erros que", 44, 300, 62, 800, "#ffffff");
    label(ctx, "travam o seu", 44, 366, 62, 800, "#ffffff");
    label(ctx, "feed", 44, 432, 62, 800, "#d8b4fe");
    lines(ctx, 44, 480, [300, 220]);

    [0, 1, 2, 3, 4].forEach((i) => {
      ctx.beginPath();
      ctx.arc(210 + i * 30, 620, i === 0 ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? "#fff" : "rgba(255,255,255,0.35)";
      ctx.fill();
    });
  },

  story(ctx) {
    const g = ctx.createLinearGradient(CARD_W, 0, 0, CARD_H);
    g.addColorStop(0, "#1b1030");
    g.addColorStop(1, "#08070c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const glow = ctx.createRadialGradient(280, 330, 20, 280, 330, 340);
    glow.addColorStop(0, "rgba(169,112,255,0.34)");
    glow.addColorStop(1, "rgba(169,112,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // barra de progresso segmentada — assinatura visual do Story
    const segs = 3;
    const gap = 10;
    const segW = (472 - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i += 1) {
      rr(ctx, 44 + i * (segW + gap), 44, segW, 8, 4);
      ctx.fillStyle = i === 0 ? "#fff" : "rgba(255,255,255,0.25)";
      ctx.fill();
    }

    pill(ctx, "STORY", 44, 76, "#c9a6ff", "rgba(169,112,255,0.16)");

    label(ctx, "Bastidores do estúdio", 44, 520, 34, 700, "#f5f4f7");
    lines(ctx, 44, 552, [340, 250], "rgba(255,255,255,0.22)");

    rr(ctx, 44, 640, 472, 10, 5);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    rr(ctx, 44, 640, 300, 10, 5);
    ctx.fillStyle = "#a970ff";
    ctx.fill();
  },

  agenda(ctx) {
    ctx.fillStyle = "#131318";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createLinearGradient(0, 0, CARD_W, 200);
    glow.addColorStop(0, "rgba(124,58,237,0.34)");
    glow.addColorStop(1, "rgba(124,58,237,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, 260);

    label(ctx, "Agenda da semana", 44, 78, 32, 700, "#f5f4f7");
    label(ctx, "12 publicações confirmadas", 44, 116, 22, 500, "#8e8b97");

    const days = ["S", "T", "Q", "Q", "S", "S", "D"];
    days.forEach((d, i) => {
      label(ctx, d, 56 + i * 70, 176, 20, 700, "#8e8b97");
    });

    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const x = 44 + col * 70;
        const y = 200 + row * 74;
        const on = (row * 7 + col) % 4 === 1;
        rr(ctx, x, y, 58, 58, 18);
        ctx.fillStyle = on ? "rgba(169,112,255,0.2)" : "rgba(255,255,255,0.04)";
        ctx.fill();
        if (on) {
          ctx.beginPath();
          ctx.arc(x + 29, y + 29, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#a970ff";
          ctx.fill();
        }
      }
    }

    rr(ctx, 44, 522, 472, 84, 26);
    ctx.fillStyle = "rgba(169,112,255,0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(169,112,255,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, "Hoje · 18:30", 74, 556, 24, 700, "#c9a6ff");
    label(ctx, "Instagram · Story na fila", 74, 588, 20, 500, "#8e8b97");
  },

  legenda(ctx) {
    ctx.fillStyle = "#0f0f13";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createRadialGradient(480, 660, 20, 480, 660, 420);
    glow.addColorStop(0, "rgba(192,132,252,0.28)");
    glow.addColorStop(1, "rgba(192,132,252,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    pill(ctx, "LEGENDA GERADA", 44, 44, "#c9a6ff", "rgba(169,112,255,0.14)");

    label(ctx, "Seu feed não precisa", 44, 200, 36, 700, "#f5f4f7");
    label(ctx, "de mais esforço.", 44, 246, 36, 700, "#f5f4f7");
    label(ctx, "Precisa de ritmo.", 44, 292, 36, 700, "#a970ff");

    lines(ctx, 44, 340, [420, 380, 330, 400], "rgba(255,255,255,0.16)");

    label(ctx, "#branding  #conteudo  #ia", 44, 530, 24, 600, "#7c3aed");

    rr(ctx, 44, 576, 220, 60, 30);
    const btn = ctx.createLinearGradient(44, 576, 264, 636);
    btn.addColorStop(0, "#a970ff");
    btn.addColorStop(1, "#6d28d9");
    ctx.fillStyle = btn;
    ctx.fill();
    label(ctx, "Aprovar", 92, 614, 24, 700, "#fff");
  },
};

export function drawCard(canvas: HTMLCanvasElement, id: CardId) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  rr(ctx, 0, 0, CARD_W, CARD_H, 46);
  ctx.clip();
  painters[id](ctx);
  ctx.restore();

  // borda de vidro
  ctx.save();
  rr(ctx, 2, 2, CARD_W - 4, CARD_H - 4, 44);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

export function createCardCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  return canvas;
}
