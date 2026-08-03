import { addDays, addHours, startOfWeek } from 'date-fns'
import type { AuditEvent, Content, Plan, PromptTemplate, QueueItem, SocialAccount, Subscription, User, WeeklyPlan } from '../domain/models'

const now = new Date()
const thisMonday = startOfWeek(now, { weekStartsOn: 1 })

// Preço mensal é a fonte da verdade. O anual deve ser sempre 12x esse
// valor com 20% de desconto — nunca um número solto. Mantenha em
// sincronia com supabase/seed.sql e src/lib/content.ts na landing page.
const MONTHLY_PLAN_PRICE = 47.9
const ANNUAL_DISCOUNT = 0.2
const ANNUAL_PLAN_PRICE = Number((MONTHLY_PLAN_PRICE * 12 * (1 - ANNUAL_DISCOUNT)).toFixed(2))
const ANNUAL_INSTALLMENT_VALUE = Number((ANNUAL_PLAN_PRICE / 12).toFixed(2))
// O anual só tem desconto no preço — o ritmo de créditos (100/mês) se
// mantém igual, então o total do ano é sempre 12x esse valor mensal.
const ANNUAL_MONTHLY_CREDITS = 100
const ANNUAL_TOTAL_CREDITS = ANNUAL_MONTHLY_CREDITS * 12

export const seedPlans: Plan[] = [
  { id: 'week', name: 'Plano semanal legado', price: 24.9, credits: 50, durationDays: 7, available: false },
  { id: 'month', name: 'Lumipost Pro — Mensal', price: MONTHLY_PLAN_PRICE, credits: 120, durationDays: 30, available: true },
  { id: 'year', name: 'Lumipost Pro — Anual', price: ANNUAL_PLAN_PRICE, credits: ANNUAL_TOTAL_CREDITS, durationDays: 365, available: true, featured: true, badge: 'Melhor custo-benefício', installments: { count: 12, value: ANNUAL_INSTALLMENT_VALUE } },
]

export const seedUsers: User[] = [
  {
    id: 'demo-user', name: 'Marina Costa', email: 'demo@lumipost.ai', password: 'Lumipost123!', role: 'user', status: 'active', onboardingCompleted: true, subscriptionId: 'sub-demo', createdAt: addDays(now, -45).toISOString(),
    brand: { brandName: 'Aurora Studio', description: 'Estratégia e identidade para marcas autorais.', industry: 'Marketing', specialty: 'Branding', audience: 'Empreendedoras criativas de 25 a 45 anos', goals: ['Gerar autoridade', 'Vender mais'], contentTypes: ['post', 'carousel', 'story', 'reel'], personality: ['Elegante', 'Próxima'], tone: ['Inspirador', 'Direto'], primaryColor: '#7C3AED', secondaryColor: '#F2EAFE', headingFont: 'Playfair Display', bodyFont: 'Inter', visualStyle: 'Elegante', instagram: 'aurorastudio', instagramConnected: true },
  },
  { id: 'admin-user', name: 'Admin Lumipost', email: 'admin@lumipost.ai', password: 'Admin123!', role: 'admin', status: 'active', onboardingCompleted: true, createdAt: addDays(now, -180).toISOString() },
  { id: 'seed-client', name: 'Rafael Lima', email: 'rafael@exemplo.com', password: 'Demo1234!', role: 'user', status: 'active', onboardingCompleted: true, subscriptionId: 'sub-client', createdAt: addDays(now, -12).toISOString(), brand: { brandName: 'Raiz Café', description: 'Cafés especiais brasileiros.', industry: 'Alimentação', specialty: 'Café especial', audience: 'Pessoas que amam café', goals: ['Vender mais'], contentTypes: ['post', 'story'], personality: ['Artesanal'], tone: ['Acolhedor'], primaryColor: '#5A3D2B', secondaryColor: '#F7E7CE', headingFont: 'Playfair Display', bodyFont: 'Inter', visualStyle: 'Orgânico', instagram: 'raizcafe', instagramConnected: true } },
]

export const seedSubscriptions: Subscription[] = [
  { id: 'sub-demo', userId: 'demo-user', planId: 'month', status: 'active', credits: 95, startsAt: addDays(now, -5).toISOString(), expiresAt: addDays(now, 25).toISOString() },
  { id: 'sub-client', userId: 'seed-client', planId: 'week', status: 'active', credits: 35, startsAt: addDays(now, -1).toISOString(), expiresAt: addDays(now, 6).toISOString() },
]

export const seedContents: Content[] = [
  { id: 'content-1', userId: 'demo-user', title: '3 sinais de que sua marca amadureceu', format: 'carousel', source: 'ai', status: 'scheduled', topic: 'Posicionamento de marca', caption: 'Sua marca cresceu — e talvez a identidade precise acompanhar esse movimento.', hashtags: ['#branding', '#marca', '#empreendedorismo'], cta: 'Salve para revisar depois', scheduledAt: addHours(now, 8).toISOString(), createdAt: addDays(now, -1).toISOString(), mediaUrls: [], slideTexts: ['Sua marca amadureceu?', 'Você atrai um público mais exigente', 'Seu discurso ficou mais claro', 'Seu visual já não acompanha', 'É hora de alinhar tudo'] },
  { id: 'content-2', userId: 'demo-user', title: 'Bastidores do processo criativo', format: 'reel', source: 'ai', status: 'draft', topic: 'Bastidores', caption: 'Um pouco do que acontece antes de uma identidade ganhar o mundo.', hashtags: ['#bastidores', '#design'], cta: 'Conte qual etapa você mais gosta', createdAt: addDays(now, -2).toISOString(), mediaUrls: ['/assets/reel-demo.mp4'], reelScript: { hook: 'Uma marca forte começa muito antes do logo.', duration: 24, scenes: [{ title: 'Pesquisa', narration: 'Tudo começa entendendo a essência.' }, { title: 'Direção', narration: 'Transformamos estratégia em escolhas visuais.' }, { title: 'Resultado', narration: 'Cada detalhe passa a contar a mesma história.' }] } },
  { id: 'content-3', userId: 'demo-user', title: 'Sua marca merece consistência', format: 'post', source: 'ai', status: 'published', topic: 'Consistência visual', caption: 'Consistência não é repetição. É reconhecimento.', hashtags: ['#identidadevisual', '#branding'], cta: 'Compartilhe com alguém', scheduledAt: addDays(now, -2).toISOString(), publishedAt: addDays(now, -2).toISOString(), createdAt: addDays(now, -6).toISOString(), mediaUrls: [], favorite: true, tags: ['Branding', 'Evergreen'], usageCount: 2, metrics: { reach: 4820, impressions: 6150, likes: 438, comments: 52, shares: 81, saves: 129, clicks: 67 } },
  { id: 'content-failed', userId: 'demo-user', title: 'Story de lançamento', format: 'story', source: 'upload', status: 'failed', topic: 'Lançamento', caption: 'A novidade está chegando.', hashtags: ['#novidade'], cta: 'Ative o lembrete', scheduledAt: addHours(now, -3).toISOString(), createdAt: addDays(now, -1).toISOString(), mediaUrls: [], failureReason: 'Conexão simulada indisponível' },
]

export const seedQueue: QueueItem[] = [
  { id: 'queue-1', contentId: 'content-1', userId: 'demo-user', scheduledAt: addHours(now, 8).toISOString(), status: 'scheduled', attempts: 0 },
  { id: 'queue-failed', contentId: 'content-failed', userId: 'demo-user', scheduledAt: addHours(now, -3).toISOString(), status: 'failed', attempts: 1, lastError: 'Conexão simulada indisponível' },
]

export const seedSocialAccounts: SocialAccount[] = [
  { id: 'social-instagram', userId: 'demo-user', network: 'instagram', handle: '@aurorastudio', displayName: 'Aurora Studio', connected: true, expiresAt: addDays(now, 20).toISOString() },
  { id: 'social-facebook', userId: 'demo-user', network: 'facebook', handle: 'Aurora Studio', displayName: 'Aurora Studio', connected: true },
]

export const seedPrompts: PromptTemplate[] = [
  { id: 'prompt-week', name: 'Planejador semanal principal', task: 'weekly-plan', format: 'all', version: 3, status: 'active', systemPrompt: 'Você é estrategista de conteúdo da {{brandName}}.', userPrompt: 'Crie {{quantity}} ideias para {{audience}} durante a semana de {{weekStart}}.', variables: ['brandName', 'audience', 'quantity', 'weekStart'], packages: [], outputSchema: '{ slots: [{ format, topic, date, time }] }', updatedAt: now.toISOString() },
  { id: 'prompt-caption', name: 'Legenda com personalidade', task: 'caption', format: 'all', version: 2, status: 'active', systemPrompt: 'Escreva como a marca {{brandName}}, com tom {{tone}}.', userPrompt: 'Crie uma legenda sobre {{topic}} com CTA objetivo.', variables: ['brandName', 'tone', 'topic'], packages: [], outputSchema: '{ caption, cta, hashtags[] }', updatedAt: now.toISOString() },
  { id: 'prompt-reel', name: 'Roteiro de Reel em 3 atos', task: 'reel-script', format: 'reel', version: 1, status: 'active', systemPrompt: 'Você cria roteiros curtos e naturais.', userPrompt: 'Escreva um Reel de 24 segundos sobre {{topic}} para {{audience}}.', variables: ['topic', 'audience'], packages: [], outputSchema: '{ hook, duration, scenes[] }', updatedAt: now.toISOString() },
  { id: 'prompt-draft', name: 'Copy promocional direta', task: 'visual-copy', format: 'post', version: 1, status: 'draft', systemPrompt: 'Crie copy curta.', userPrompt: '{{topic}}', variables: ['topic'], packages: ['marketing'], outputSchema: '{ headline, subtitle }', updatedAt: addDays(now, -2).toISOString() },
]

export const seedWeeklyPlans: WeeklyPlan[] = [{ id: 'week-demo', userId: 'demo-user', weekStart: thisMonday.toISOString(), status: 'confirmed', slots: [] }]
export const seedAudit: AuditEvent[] = [
  { id: 'audit-1', actor: 'Admin Lumipost', action: 'Ativou o prompt v3', entity: 'Planejador semanal principal', at: addHours(now, -4).toISOString() },
  { id: 'audit-2', actor: 'Admin Lumipost', action: 'Atualizou créditos', entity: 'Marina Costa', at: addDays(now, -1).toISOString() },
]
