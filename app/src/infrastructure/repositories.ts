import type { AiContentDraft, AiGenerationRequest, AuditEvent, BrandProfile, Content, Plan, PromptTemplate, QueueItem, SocialAccount, Subscription, TemplateMeta, User, VisualTemplateV2, WeeklyPlan } from '../domain/models'
import type { AiGenerationRepository, AuditRepository, AuthRepository, ContentRepository, MediaRepository, PlannerRepository, PromptRepository, PublishingQueueRepository, SocialAccountRepository, SubscriptionRepository, TemplateRepository, UserRepository, WeeklyPlanProgress } from '../domain/repositories'
import { seedAudit, seedContents, seedPlans, seedPrompts, seedQueue, seedSocialAccounts, seedSubscriptions, seedUsers, seedWeeklyPlans } from './seed'
import { validateTemplate } from './templateSchema'

const clone = <T,>(value: T): T => structuredClone(value)
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

class MemoryState {
  users = clone(seedUsers); plans = clone(seedPlans); subscriptions = clone(seedSubscriptions); contents = clone(seedContents); queue = clone(seedQueue); prompts = clone(seedPrompts); weeklyPlans = clone(seedWeeklyPlans); audit = clone(seedAudit); socialAccounts = clone(seedSocialAccounts)
  templateCatalog: TemplateMeta[] | null = null
  templateSpecs = new Map<string, VisualTemplateV2>()
}

export const memory = new MemoryState()

export class MemoryAuthRepository implements AuthRepository {
  async login(email: string, password: string) { const user = memory.users.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password); if (!user) throw new Error('Email ou senha incorretos.'); if (user.status !== 'active') throw new Error('Esta conta está suspensa.'); return clone(user) }
  async loginWithGoogle() { throw new Error('Google OAuth não está disponível no repositório de teste.') }
  async register(input: { name: string; email: string; password: string }) { if (memory.users.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) throw new Error('Este email já está cadastrado.'); const user: User = { id: uid('user'), ...input, email: input.email.toLowerCase(), role: 'user', status: 'active', onboardingCompleted: false, createdAt: new Date().toISOString() }; memory.users.push(user); return clone(user) }
  async current() { return undefined }
  async logout() { /* No persistent session in demo mode. */ }
}

export class MemoryUserRepository implements UserRepository {
  async list() { return clone(memory.users) }
  async find(id: string) { const item = memory.users.find((user) => user.id === id); return item ? clone(item) : undefined }
  async update(id: string, patch: Partial<User>) { const index = memory.users.findIndex((user) => user.id === id); if (index < 0) throw new Error('Usuário não encontrado.'); memory.users[index] = { ...memory.users[index], ...patch }; return clone(memory.users[index]) }
  async completeOnboarding(id: string, brand: BrandProfile) { return this.update(id, { brand, onboardingCompleted: true }) }
}

export class MemorySubscriptionRepository implements SubscriptionRepository {
  async listPlans() { return clone(memory.plans) }
  async list() { return clone(memory.subscriptions) }
  async findForUser(userId: string) { const item = memory.subscriptions.find((sub) => sub.userId === userId && sub.status === 'active'); return item ? clone(item) : undefined }
  async subscribe(userId: string, planId: Plan['id']) { const plan = memory.plans.find((item) => item.id === planId && item.available); if (!plan) throw new Error('Plano indisponível.'); memory.subscriptions.forEach((sub) => { if (sub.userId === userId) sub.status = 'canceled' }); const starts = new Date(); const expires = new Date(starts); expires.setDate(expires.getDate() + plan.durationDays); const subscription: Subscription = { id: uid('sub'), userId, planId, status: 'active', credits: plan.credits, startsAt: starts.toISOString(), expiresAt: expires.toISOString() }; memory.subscriptions.push(subscription); const user = memory.users.find((item) => item.id === userId); if (user) user.subscriptionId = subscription.id; return clone(subscription) }
  async spend(userId: string, amount: number) { const sub = memory.subscriptions.find((item) => item.userId === userId && item.status === 'active'); if (!sub) throw new Error('Assinatura ativa necessária.'); if (sub.credits < amount) throw new Error('Créditos insuficientes para concluir esta ação.'); sub.credits -= amount; return clone(sub) }
  async addCredits(userId: string, amount: number) { const sub = memory.subscriptions.find((item) => item.userId === userId && item.status === 'active'); if (!sub) throw new Error('Assinatura ativa necessária para comprar créditos adicionais.'); if (!Number.isInteger(amount) || amount <= 0) throw new Error('Quantidade de créditos inválida.'); sub.credits += amount; return clone(sub) }
  async updatePlan(id: Plan['id'], patch: Partial<Plan>) { const index = memory.plans.findIndex((item) => item.id === id); if (index < 0) throw new Error('Plano não encontrado.'); memory.plans[index] = { ...memory.plans[index], ...patch, id }; return clone(memory.plans[index]) }
}

export class MemoryContentRepository implements ContentRepository {
  async list(userId?: string) { return clone(userId ? memory.contents.filter((item) => item.userId === userId) : memory.contents) }
  async find(id: string) { const item = memory.contents.find((content) => content.id === id); return item ? clone(item) : undefined }
  async save(content: Content) { const index = memory.contents.findIndex((item) => item.id === content.id); if (index >= 0) memory.contents[index] = clone(content); else memory.contents.unshift(clone(content)); return clone(content) }
  async update(id: string, patch: Partial<Content>) { const index = memory.contents.findIndex((item) => item.id === id); if (index < 0) throw new Error('Conteúdo não encontrado.'); memory.contents[index] = { ...memory.contents[index], ...patch, updatedAt: new Date().toISOString() }; return clone(memory.contents[index]) }
  async remove(id: string) { memory.contents = memory.contents.filter((item) => item.id !== id) }
}

export class MemoryPlannerRepository implements PlannerRepository {
  async save(plan: WeeklyPlan) { const index = memory.weeklyPlans.findIndex((item) => item.id === plan.id); if (index >= 0) memory.weeklyPlans[index] = clone(plan); else memory.weeklyPlans.push(clone(plan)); return clone(plan) }
  async list(userId: string) { return clone(memory.weeklyPlans.filter((item) => item.userId === userId)) }
  async listWeeklyPlanSummaries() { return [] /* modo offline não mantém progresso persistido */ }
  async createPendingWeeklyPlan(input: Parameters<PlannerRepository['createPendingWeeklyPlan']>[0]) {
    const planId = uid('week')
    const slotIds = input.items.map(() => uid('weekly-slot'))
    return { planId, slotIds }
  }
  async resolveWeeklySlot() { /* modo offline não mantém progresso persistido */ }
  async retryWeeklySlot() { /* modo offline não mantém progresso persistido */ }
  async getWeeklyPlanProgress(planId: string): Promise<WeeklyPlanProgress> {
    return { planId, weekStart: '', status: 'confirmed', slots: [] }
  }
  subscribeToWeeklyPlanProgress() { return () => {} }
}

export class BrowserTemplateRepository implements TemplateRepository {
  async list() { if (typeof window === 'undefined') return []; if (!memory.templateCatalog) { const response = await fetch('/templates/catalog.json'); if (!response.ok) throw new Error('Catálogo de templates indisponível.'); memory.templateCatalog = await response.json() as TemplateMeta[] } return clone(memory.templateCatalog) }
  async load(id: string) { const edited = memory.templateSpecs.get(id); if (edited) return clone(edited); const meta = (await this.list()).find((item) => item.id === id); if (!meta) throw new Error('Template não encontrado.'); const response = await fetch(meta.path); if (!response.ok) throw new Error('Arquivo do template indisponível.'); const spec = validateTemplate(await response.json()) as VisualTemplateV2; return clone(spec) }
  async save(meta: TemplateMeta, spec: VisualTemplateV2) { validateTemplate(spec); if (!memory.templateCatalog) await this.list(); const index = memory.templateCatalog!.findIndex((item) => item.id === meta.id); const saved = { ...meta, version: index >= 0 ? memory.templateCatalog![index].version + 1 : 1, status: meta.status ?? 'draft' } as TemplateMeta; if (index >= 0) memory.templateCatalog![index] = saved; else memory.templateCatalog!.unshift(saved); memory.templateSpecs.set(saved.id, clone(spec)); return clone(saved) }
  async import(items: { meta: TemplateMeta; spec: VisualTemplateV2 }[], conflict: 'replace' | 'rename' | 'skip') { if (!memory.templateCatalog) await this.list(); const imported: TemplateMeta[] = []; for (const item of items) { validateTemplate(item.spec); let meta = clone(item.meta); const existing = memory.templateCatalog!.find((entry) => entry.id === meta.id); if (existing && conflict === 'skip') continue; if (existing && conflict === 'rename') { const suffix = Math.random().toString(36).slice(2, 6); meta = { ...meta, id: `${meta.id}-${suffix}`, templateId: `${meta.templateId}-${suffix}`, name: `${meta.name} (importado)` } } await this.save(meta, item.spec); imported.push(meta) } return imported }
}

export class MemoryPromptRepository implements PromptRepository {
  async list() { return clone(memory.prompts) }
  async save(prompt: PromptTemplate) { if (prompt.status === 'active') memory.prompts.forEach((item) => { if (item.id !== prompt.id && item.task === prompt.task && item.format === prompt.format && item.status === 'active') item.status = 'archived' }); const index = memory.prompts.findIndex((item) => item.id === prompt.id); if (index >= 0) memory.prompts[index] = clone(prompt); else memory.prompts.unshift(clone(prompt)); return clone(prompt) }
  async remove(id: string) { memory.prompts = memory.prompts.filter((item) => item.id !== id) }
}

export class MemoryQueueRepository implements PublishingQueueRepository { async list() { return clone(memory.queue) } async enqueue(items: QueueItem[]) { memory.queue.push(...clone(items)); return clone(items) } async update(id: string, patch: Partial<QueueItem>) { const index = memory.queue.findIndex((item) => item.id === id); if (index < 0) throw new Error('Item da fila não encontrado.'); memory.queue[index] = { ...memory.queue[index], ...patch }; return clone(memory.queue[index]) } }
export class MemoryAuditRepository implements AuditRepository { async list() { return clone(memory.audit) } async add(event: Omit<AuditEvent, 'id' | 'at'>) { const item: AuditEvent = { ...event, id: uid('audit'), at: new Date().toISOString() }; memory.audit.unshift(item); return clone(item) } }

export class MemoryAiGenerationRepository implements AiGenerationRepository {
  async preview(request: AiGenerationRequest, brand?: BrandProfile): Promise<AiContentDraft[]> {
    const brandName = brand?.brandName ?? 'Sua marca'
    const variants = [
      { prefix: 'Um novo olhar para', cta: 'Salve para consultar depois' },
      { prefix: 'O que ninguém te conta sobre', cta: 'Compartilhe com alguém' },
      { prefix: '3 passos para evoluir em', cta: 'Qual passo você começa hoje?' },
    ]
    const slides = request.format === 'carousel' ? 5 : 1
    const unitCost = request.format === 'carousel' ? slides * 5 : request.format === 'video' ? 15 : request.format === 'caption' ? 2 : 5
    return Array.from({ length: Math.min(3, Math.max(1, request.variations)) }, (_, index) => {
      const variant = variants[index % variants.length]
      const title = `${variant.prefix} ${request.topic}`
      return { id: uid('ai-draft'), title, topic: request.topic, format: request.format, caption: `${request.objective}. ${brandName} apresenta ${request.topic.toLowerCase()} com uma abordagem ${request.style.toLowerCase()}. ${request.instructions ?? ''}`.trim(), hashtags: ['#conteudo', '#estrategia', '#marketingdigital'], cta: variant.cta, slides, creditCost: unitCost }
    })
  }
}

export class MemorySocialAccountRepository implements SocialAccountRepository {
  async list(userId: string) { return clone(memory.socialAccounts.filter((item) => item.userId === userId)) }
  async update(id: string, patch: Partial<SocialAccount>) { const index = memory.socialAccounts.findIndex((item) => item.id === id); if (index < 0) throw new Error('Conta social não encontrada.'); memory.socialAccounts[index] = { ...memory.socialAccounts[index], ...patch }; return clone(memory.socialAccounts[index]) }
}

export class MemoryMediaRepository implements MediaRepository {
  async upload(files: File[]) {
    return files.map((file) => URL.createObjectURL(file))
  }
}
