/**
 * Copy da landing page — todos os números vêm do domínio real do app
 * (src/domain/creditRules.ts, src/infrastructure/seed.ts, src/domain/models.ts).
 */

export const APP_URL = "https://app.lumipost.com.br";

// Rotas reais do app (src/presentation/App.tsx): a tela de login é /entrar
// e a de cadastro é /registrar — nunca /login ou /signup.
export const LOGIN_PATH = "/entrar";
export const REGISTER_PATH = "/registrar";

export const NAV_LINKS = [
  { href: "#produto", label: "Produto" },
  { href: "#recursos", label: "Recursos" },
  { href: "#formatos", label: "Formatos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
] as const;

export const HERO_STATS = [
  { value: "5", label: "conteúdos por dia selecionado" },
  { value: "4", label: "formatos gerados pela IA" },
  { value: "2", label: "créditos por agendamento manual" },
] as const;

export const NETWORKS = [
  "Instagram",
  "Planejamento com IA",
  "Post",
  "Carrossel",
  "Story",
  "Créditos transparentes",
  "Calendário editorial",
  "Aprovação em um toque",
] as const;

/** Etapas da seção 3D fixada (scroll estilo Apple). */
export const STORY_STEPS = [
  {
    id: "identidade",
    kicker: "01 — Identidade",
    title: "Ensine sua marca uma vez",
    body: "Tom de voz, público, cores e assinatura visual ficam salvos. Toda geração nasce falando como você.",
  },
  {
    id: "plano",
    kicker: "02 — Planejamento",
    title: "A IA monta a semana inteira",
    body: "Escolha os dias e os formatos. O planejador devolve temas, legendas, hashtags e horários prontos para revisão.",
  },
  {
    id: "aprovacao",
    kicker: "03 — Aprovação",
    title: "Você aprova em um toque",
    body: "Editor de template com arrastar e soltar, troca de imagem e ajuste de legenda. Nada é publicado sem o seu sim.",
  },
  {
    id: "publicacao",
    kicker: "04 — Publicação",
    title: "Publica sozinho, no horário certo",
    body: "A fila cuida do resto: agenda, publica e reprocessa falhas — com histórico auditável de cada envio.",
  },
] as const;

export const FEATURES = [
  {
    icon: "wand",
    title: "Planejamento semanal com IA",
    body: "Um plano completo por semana com tema, formato, legenda e horário sugerido para cada slot.",
    span: "lg:col-span-2",
  },
  {
    icon: "palette",
    title: "Identidade de marca",
    body: "Paleta, logo, tom de voz e público salvos e aplicados em cada peça gerada.",
    span: "",
  },
  {
    icon: "layers",
    title: "Editor de templates",
    body: "Camadas de texto e imagem com arrastar, redimensionar e exportar em PNG ou ZIP.",
    span: "",
  },
  {
    icon: "calendar",
    title: "Calendário e fila",
    body: "Visão de mês e semana, arraste para reagendar e acompanhe o status de cada publicação.",
    span: "lg:col-span-2",
  },
  {
    icon: "library",
    title: "Biblioteca de conteúdos",
    body: "Rascunho, aguardando aprovação, agendado, publicado. Tudo versionado e reaproveitável.",
    span: "",
  },
  {
    icon: "wallet",
    title: "Créditos transparentes",
    body: "Carteira com extrato: cada geração e cada agendamento manual custa exatamente o que está na tabela.",
    span: "",
  },
  {
    icon: "shield",
    title: "Seguro por padrão",
    body: "Isolamento por conta, tokens sociais em cofre criptografado e auditoria de toda ação crítica.",
    span: "",
  },
] as const;

export const FORMATS = [
  { name: "Post", body: "Imagem única com legenda e hashtags no tom da marca.", ratio: "1:1" },
  { name: "Carrossel", body: "Sequência de slides com roteiro encadeado e capa forte.", ratio: "4:5" },
  { name: "Story", body: "Peça vertical rápida, no mesmo estilo do post, redimensionada.", ratio: "9:16" },
  { name: "Apenas legenda", body: "Só o texto, quando a imagem já é sua.", ratio: "—" },
] as const;

/**
 * Preço mensal é a única fonte da verdade. O anual deve ser sempre
 * 12x esse valor com 20% de desconto — nunca um número solto aqui.
 * Mantenha em sincronia com o preço do plano "month" no Supabase
 * (supabase/seed.sql e src/infrastructure/seed.ts no app).
 */
const MONTHLY_PLAN_PRICE = 47.9
const ANNUAL_DISCOUNT = 0.2
const ANNUAL_PLAN_PRICE = Number(
  (MONTHLY_PLAN_PRICE * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(2),
)
const ANNUAL_INSTALLMENT_VALUE = Number((ANNUAL_PLAN_PRICE / 12).toFixed(2))

// O anual só tem desconto no preço — o ritmo de créditos (100/mês) se
// mantém igual, então o total do ano é sempre 12x esse valor mensal.
const ANNUAL_MONTHLY_CREDITS = 100
const ANNUAL_TOTAL_CREDITS = ANNUAL_MONTHLY_CREDITS * 12

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export const PLANS = [
  {
    id: "month",
    name: "Pro Mensal",
    price: brl(MONTHLY_PLAN_PRICE),
    period: "/mês",
    credits: "120 créditos por mês",
    featured: false,
    badge: null as string | null,
    perks: [
      "Planejamento semanal com IA",
      "Até 5 conteúdos por dia selecionado",
      "Conta profissional do Instagram conectada",
      "Editor de templates e biblioteca",
    ],
  },
  {
    id: "year",
    name: "Pro Anual",
    price: brl(ANNUAL_PLAN_PRICE),
    period: "/ano",
    credits: `${ANNUAL_TOTAL_CREDITS.toLocaleString("pt-BR")} créditos por ano`,
    featured: true,
    badge: "Melhor custo-benefício",
    perks: [
      "Tudo do plano mensal",
      `12x de ${brl(ANNUAL_INSTALLMENT_VALUE)}`,
      "Prioridade na fila de geração",
      "Histórico e auditoria completos",
    ],
  },
] as const;

export const CREDIT_PACKAGES = [
  { name: "Impulso", credits: 50, price: "R$ 19,90", note: "Até 25 agendamentos manuais" },
  { name: "Crescimento", credits: 150, price: "R$ 49,90", note: "Até 75 agendamentos manuais" },
  { name: "Escala", credits: 400, price: "R$ 109,90", note: "Até 200 agendamentos manuais" },
] as const;

export const FAQ = [
  {
    q: "A IA publica sem eu ver?",
    a: "Não. Todo conteúdo passa por aprovação antes de entrar na fila. Você edita legenda, imagem e horário, e só então ele é agendado.",
  },
  {
    q: "Como funcionam os créditos?",
    a: "Cada plano vem com um saldo mensal ou anual. Gerações consomem créditos conforme o formato e o agendamento manual custa exatamente 2 créditos, cobrados uma única vez. A carteira nunca fica negativa.",
  },
  {
    q: "Quantos conteúdos posso criar?",
    a: "Até cinco conteúdos por dia selecionado no planejamento — o suficiente para manter presença diária no seu Instagram.",
  },
  {
    q: "Quais redes são suportadas?",
    a: "Instagram, com conta profissional conectada por login oficial da Meta. Os tokens ficam em cofre criptografado, nunca em texto puro.",
  },
  {
    q: "E se uma publicação falhar?",
    a: "O job é persistido em fila. Falhas são reprocessadas, os créditos reservados são liberados conforme a política e tudo fica registrado na auditoria.",
  },
  {
    q: "Preciso saber design?",
    a: "Não. Os templates já vêm no padrão da sua marca. Se quiser ajustar, o editor tem camadas de texto e imagem com arrastar e soltar.",
  },
] as const;
