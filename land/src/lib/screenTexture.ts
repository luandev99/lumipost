/**
 * Telas do app desenhadas em canvas 2D para virar textura da tela do 3D.
 * Mantém as cores do tema dark do Lumipost (src/index.css do app).
 */

export const SCREEN_W = 800;
export const SCREEN_H = 1730;

const C = {
  bg: "#0b0b0e",
  card: "#17171c",
  cardAlt: "#1e1e25",
  line: "rgba(255,255,255,0.075)",
  text: "#f5f4f7",
  muted: "#8e8b97",
  primary: "#a970ff",
  primaryDeep: "#7c3aed",
  accent: "#c084fc",
  green: "#4ade80",
  amber: "#fbbf24",
};

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

export type ScreenId = "identidade" | "plano" | "aprovacao" | "publicacao";

/* ------------------------------- primitivas ------------------------------- */

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

function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 26,
  fill = C.card,
) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  {
    size = 26,
    weight = 500,
    color = C.text,
    align = "left" as CanvasTextAlign,
  } = {},
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}

function chip(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  { color = C.primary, bg = "rgba(169,112,255,0.14)", size = 20 } = {},
) {
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(label).width + 30;
  const h = size + 20;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  text(ctx, label, x + 15, y + h / 2 + size * 0.36, { size, weight: 700, color });
  return w;
}

function gradientBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  from: string,
  to: string,
  angle = 0,
) {
  const g = ctx.createLinearGradient(
    x,
    y,
    x + Math.cos(angle) * w || x + w,
    y + h,
  );
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
}

function bars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  widths: number[],
  gap = 20,
  h = 12,
  color = "rgba(255,255,255,0.13)",
) {
  widths.forEach((w, i) => {
    rr(ctx, x, y + i * (h + gap), w, h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

/* --------------------------------- chrome --------------------------------- */

function statusBar(ctx: CanvasRenderingContext2D) {
  text(ctx, "9:41", 58, 78, { size: 26, weight: 700 });
  // sinal / wifi / bateria simplificados
  const bx = SCREEN_W - 170;
  [10, 15, 20, 25].forEach((h, i) => {
    rr(ctx, bx + i * 13, 70 - h, 8, h, 3);
    ctx.fillStyle = C.text;
    ctx.fill();
  });
  rr(ctx, SCREEN_W - 108, 46, 50, 26, 8);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();
  rr(ctx, SCREEN_W - 104, 50, 36, 18, 5);
  ctx.fillStyle = C.text;
  ctx.fill();
}

function header(ctx: CanvasRenderingContext2D, title: string, sub: string) {
  gradientBlock(ctx, 58, 118, 66, 66, 20, C.primary, C.primaryDeep);
  text(ctx, "L", 78, 168, { size: 42, weight: 800, color: "#fff" });
  text(ctx, title, 142, 152, { size: 30, weight: 700 });
  text(ctx, sub, 142, 184, { size: 22, weight: 500, color: C.muted });

  rr(ctx, SCREEN_W - 176, 122, 118, 58, 29);
  ctx.fillStyle = "rgba(169,112,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(169,112,255,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, "95 cr", SCREEN_W - 117, 160, {
    size: 24,
    weight: 700,
    color: C.primary,
    align: "center",
  });
}

function bottomNav(ctx: CanvasRenderingContext2D, active: number) {
  const y = SCREEN_H - 168;
  rr(ctx, 42, y, SCREEN_W - 84, 108, 40);
  ctx.fillStyle = "rgba(18,18,22,0.94)";
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  const labels = ["Início", "Agenda", "", "Conteúdos", "Mais"];
  const step = (SCREEN_W - 84) / 5;
  labels.forEach((label, i) => {
    const cx = 42 + step * i + step / 2;
    if (i === 2) {
      gradientBlock(ctx, cx - 38, y - 18, 76, 76, 26, C.primary, C.primaryDeep);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 17, y + 20);
      ctx.lineTo(cx + 17, y + 20);
      ctx.moveTo(cx, y + 3);
      ctx.lineTo(cx, y + 37);
      ctx.stroke();
      return;
    }
    const on = i === active;
    rr(ctx, cx - 16, y + 26, 32, 26, 8);
    ctx.fillStyle = on ? C.primary : "rgba(255,255,255,0.22)";
    ctx.fill();
    text(ctx, label, cx, y + 84, {
      size: 19,
      weight: on ? 700 : 500,
      color: on ? C.primary : C.muted,
      align: "center",
    });
  });
}

/* --------------------------------- telas ---------------------------------- */

function screenIdentidade(ctx: CanvasRenderingContext2D) {
  header(ctx, "Identidade", "Como a IA fala por você");

  card(ctx, 58, 236, SCREEN_W - 116, 250, 34);
  gradientBlock(ctx, 92, 272, 110, 110, 30, "#c084fc", C.primaryDeep);
  text(ctx, "Studio Aurora", 226, 318, { size: 34, weight: 700 });
  text(ctx, "@studioaurora · Design & branding", 226, 356, {
    size: 22,
    color: C.muted,
  });
  let cx = 92;
  ["Próximo", "Inspirador", "Direto"].forEach((t) => {
    cx += chip(ctx, t, cx, 408) + 14;
  });

  text(ctx, "PALETA DA MARCA", 58, 560, {
    size: 20,
    weight: 800,
    color: C.primary,
  });
  ["#a970ff", "#7c3aed", "#c084fc", "#f5f4f7", "#18181d"].forEach((color, i) => {
    rr(ctx, 58 + i * 106, 588, 88, 88, 26);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  card(ctx, 58, 716, SCREEN_W - 116, 210, 30, C.cardAlt);
  text(ctx, "Público", 96, 768, { size: 26, weight: 700 });
  bars(ctx, 96, 800, [560, 480, 380], 22, 14);

  card(ctx, 58, 960, SCREEN_W - 116, 200, 30);
  text(ctx, "Assinatura visual", 96, 1012, { size: 26, weight: 700 });
  text(ctx, "Aplicada em todos os templates", 96, 1048, {
    size: 21,
    color: C.muted,
  });
  gradientBlock(ctx, 96, 1074, SCREEN_W - 192, 54, 18, "rgba(169,112,255,0.35)", "rgba(124,58,237,0.08)");

  card(ctx, 58, 1194, SCREEN_W - 116, 190, 30, C.cardAlt);
  text(ctx, "Rede conectada", 96, 1246, { size: 26, weight: 700 });
  rr(ctx, 96, 1280, SCREEN_W - 192, 76, 24);
  ctx.fillStyle = "rgba(169,112,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(169,112,255,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, "Instagram · @suamarca", 128, 1328, {
    size: 24,
    weight: 800,
    color: C.primary,
  });
  ctx.beginPath();
  ctx.arc(SCREEN_W - 96 - 38, 1318, 16, 0, Math.PI * 2);
  ctx.fillStyle = C.green;
  ctx.fill();

  bottomNav(ctx, 4);
}

function screenPlano(ctx: CanvasRenderingContext2D) {
  header(ctx, "Planejamento", "Semana de 4 a 10 de agosto");

  card(ctx, 58, 236, SCREEN_W - 116, 132, 30, C.cardAlt);
  text(ctx, "Gerando plano semanal", 96, 292, { size: 26, weight: 700 });
  rr(ctx, 96, 316, SCREEN_W - 192, 16, 8);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  gradientBlock(ctx, 96, 316, (SCREEN_W - 192) * 0.78, 16, 8, C.primaryDeep, "#e9d5ff");
  text(ctx, "4 de 5", SCREEN_W - 96, 302, {
    size: 22,
    weight: 700,
    color: C.primary,
    align: "right",
  });

  const rows = [
    ["Seg · 09:00", "Carrossel", "5 erros que travam seu feed", "Gerado"],
    ["Ter · 12:30", "Post", "Bastidores do estúdio", "Gerado"],
    ["Qua · 18:00", "Post", "Antes e depois: rebrand", "Gerado"],
    ["Qui · 09:30", "Story", "Enquete: qual paleta?", "Gerado"],
    ["Sex · 17:00", "Legenda", "Sexta de portfólio", "Gerando"],
  ];

  rows.forEach((row, i) => {
    const y = 406 + i * 172;
    card(ctx, 58, y, SCREEN_W - 116, 148, 30);
    gradientBlock(
      ctx,
      92,
      y + 24,
      100,
      100,
      26,
      i % 2 ? "#7c3aed" : "#a970ff",
      i % 2 ? "#3b0764" : "#5b21b6",
    );
    text(ctx, row[0], 216, y + 52, { size: 21, weight: 700, color: C.primary });
    text(ctx, row[2], 216, y + 88, { size: 25, weight: 600 });
    text(ctx, row[1], 216, y + 122, { size: 20, color: C.muted });
    const done = row[3] === "Gerado";
    chip(ctx, row[3], SCREEN_W - 226, y + 46, {
      color: done ? C.green : C.amber,
      bg: done ? "rgba(74,222,128,0.12)" : "rgba(251,191,36,0.12)",
      size: 18,
    });
  });

  bottomNav(ctx, 0);
}

function screenAprovacao(ctx: CanvasRenderingContext2D) {
  header(ctx, "Aprovação", "Rascunho gerado pela IA");

  // preview do conteúdo
  gradientBlock(ctx, 58, 236, SCREEN_W - 116, 860, 40, "#2a1055", "#0d0a18");
  const g = ctx.createRadialGradient(400, 520, 40, 400, 520, 520);
  g.addColorStop(0, "rgba(169,112,255,0.55)");
  g.addColorStop(1, "rgba(169,112,255,0)");
  rr(ctx, 58, 236, SCREEN_W - 116, 860, 40);
  ctx.fillStyle = g;
  ctx.fill();

  text(ctx, "CARROSSEL · 1 de 6", 108, 320, {
    size: 21,
    weight: 800,
    color: "#e9d5ff",
  });
  text(ctx, "5 erros que", 108, 450, { size: 76, weight: 800 });
  text(ctx, "travam o seu", 108, 536, { size: 76, weight: 800 });
  text(ctx, "feed em 2026", 108, 622, {
    size: 76,
    weight: 800,
    color: C.accent,
  });
  bars(ctx, 108, 700, [420, 340], 22, 12, "rgba(255,255,255,0.28)");

  // pontos do carrossel
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    ctx.beginPath();
    ctx.arc(320 + i * 32, 1040, i === 0 ? 9 : 6, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "#fff" : "rgba(255,255,255,0.35)";
    ctx.fill();
  });

  card(ctx, 58, 1130, SCREEN_W - 116, 210, 30, C.cardAlt);
  text(ctx, "Legenda sugerida", 96, 1182, { size: 24, weight: 700 });
  bars(ctx, 96, 1212, [600, 540, 470], 20, 13);

  // ações
  gradientBlock(ctx, 58, 1378, SCREEN_W - 116, 96, 48, C.primary, C.primaryDeep);
  text(ctx, "Aprovar e agendar", SCREEN_W / 2, 1438, {
    size: 30,
    weight: 700,
    color: "#fff",
    align: "center",
  });
  rr(ctx, 58, 1494, SCREEN_W - 116, 92, 46);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, "Editar template", SCREEN_W / 2, 1550, {
    size: 28,
    weight: 600,
    color: C.text,
    align: "center",
  });
}

function screenPublicacao(ctx: CanvasRenderingContext2D) {
  header(ctx, "Agenda", "Fila de publicação ativa");

  card(ctx, 58, 236, SCREEN_W - 116, 430, 34);
  text(ctx, "Agosto", 96, 296, { size: 30, weight: 700 });
  ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d, i) => {
    text(ctx, d, 118 + i * 96, 350, {
      size: 20,
      weight: 700,
      color: C.muted,
      align: "center",
    });
  });
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const cx = 118 + col * 96;
      const cy = 400 + row * 66;
      const marked = (row * 7 + col) % 3 === 1;
      const today = row === 1 && col === 3;
      if (today) {
        ctx.beginPath();
        ctx.arc(cx, cy - 8, 30, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(169,112,255,0.18)";
        ctx.fill();
      }
      text(ctx, String(row * 7 + col + 1), cx, cy, {
        size: 22,
        weight: today ? 800 : 500,
        color: today ? C.primary : "rgba(245,244,247,0.7)",
        align: "center",
      });
      if (marked) {
        ctx.beginPath();
        ctx.arc(cx, cy + 16, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.primary;
        ctx.fill();
      }
    }
  }

  text(ctx, "NA FILA", 58, 726, { size: 20, weight: 800, color: C.primary });

  const queue = [
    ["Instagram", "Carrossel · hoje 09:00", "Publicado", C.green],
    ["Instagram", "Story · hoje 18:30", "Agendado", C.primary],
    ["Instagram", "Post · amanhã 08:00", "Na fila", C.amber],
    ["Instagram", "Legenda · amanhã 12:00", "Agendado", C.primary],
  ];

  queue.forEach((row, i) => {
    const y = 764 + i * 158;
    card(ctx, 58, y, SCREEN_W - 116, 134, 30);
    rr(ctx, 92, y + 30, 74, 74, 24);
    ctx.fillStyle = "rgba(169,112,255,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(169,112,255,0.26)";
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, row[0].slice(0, 2).toUpperCase(), 129, y + 78, {
      size: 24,
      weight: 800,
      color: C.primary,
      align: "center",
    });
    text(ctx, row[0], 194, y + 60, { size: 26, weight: 700 });
    text(ctx, row[1], 194, y + 96, { size: 21, color: C.muted });
    chip(ctx, row[2], SCREEN_W - 250, y + 44, {
      color: row[3],
      bg: `${row[3]}1f`,
      size: 18,
    });
  });

  bottomNav(ctx, 1);
}

const SCREENS: Record<ScreenId, (ctx: CanvasRenderingContext2D) => void> = {
  identidade: screenIdentidade,
  plano: screenPlano,
  aprovacao: screenAprovacao,
  publicacao: screenPublicacao,
};

/** Desenha a tela pedida num canvas já dimensionado. */
export function drawScreen(canvas: HTMLCanvasElement, id: ScreenId) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.save();
  rr(ctx, 0, 0, SCREEN_W, SCREEN_H, 92); // cantos arredondados = tela do device
  ctx.clip();

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // brilho ambiente do app
  const glow = ctx.createRadialGradient(400, -140, 60, 400, -140, 900);
  glow.addColorStop(0, "rgba(124,58,237,0.30)");
  glow.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  statusBar(ctx);
  SCREENS[id](ctx);

  // notch
  rr(ctx, SCREEN_W / 2 - 105, 26, 210, 54, 27);
  ctx.fillStyle = "#000";
  ctx.fill();

  ctx.restore();
}

export function createScreenCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  return canvas;
}
