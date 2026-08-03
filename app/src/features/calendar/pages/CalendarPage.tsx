import { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, FilterX, History, List, Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ContentFormat, ContentSource, ContentStatus } from '../../../domain/models'
import type { WeeklyPlanSummary } from '../../../domain/repositories'
import { useAppDispatch, useAppSelector } from '../../../presentation/store/hooks'
import { deleteContentItem, duplicateContent, fetchWeeklyPlanSummaries, publishQueueItem, rescheduleQueueItem, retryQueue, scheduleContent } from '../../../presentation/store/store'
import { Button, Card, ConfirmDialog, EmptyState, Notice, PageHeader, Segmented, Select } from '../../../presentation/ui'
import { AddContentModal } from '../components/AddContentModal'
import { CalendarContentCard } from '../components/CalendarContentCard'
import { CalendarDay, type CalendarEntry } from '../components/CalendarDay'
import { entriesForDay } from '../calendarUtils'

type CalendarView = 'week' | 'month' | 'list'

export function CalendarPage({ initialView = 'week' }: { initialView?: CalendarView }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const user = useAppSelector((state) => state.auth.user)!
  const contents = useAppSelector((state) => state.contents.items)
  const queue = useAppSelector((state) => state.contents.queue)
  const [view, setView] = useState<CalendarView>(initialView)
  const [anchor, setAnchor] = useState(new Date())
  const [addDate, setAddDate] = useState<string | undefined>(params.get('add') ?? undefined)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContentStatus | 'all'>('all')
  const [formatFilter, setFormatFilter] = useState<ContentFormat | 'all'>('all')
  const [source, setSource] = useState<ContentSource | 'all'>('all')
  const [network, setNetwork] = useState('all')
  const [notice, setNotice] = useState('')
  const [deleteEntry, setDeleteEntry] = useState<CalendarEntry>()
  const [planSummaries, setPlanSummaries] = useState<WeeklyPlanSummary[]>([])
  useEffect(() => { dispatch(fetchWeeklyPlanSummaries(user.id)).unwrap().then(setPlanSummaries).catch(() => {}) }, [dispatch, user.id])
  const inProgressPlans = planSummaries.filter((plan) => plan.pending > 0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const contentMap = useMemo(() => new Map(contents.map((content) => [content.id, content])), [contents])
  const allEntries = useMemo(() => queue.map((queueItem) => ({ queueItem, content: contentMap.get(queueItem.contentId) })).filter((entry): entry is CalendarEntry => Boolean(entry.content)), [contentMap, queue])
  const filtered = allEntries.filter((entry) => (!search || `${entry.content.title} ${entry.content.caption}`.toLowerCase().includes(search.toLowerCase())) && (status === 'all' || entry.content.status === status) && (formatFilter === 'all' || entry.content.format === formatFilter) && (source === 'all' || entry.content.source === source) && (network === 'all' || entry.queueItem.socialAccountId === network))
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })
  const monthStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const monthEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  const visibleDays = view === 'month' ? eachDayOfInterval({ start: monthStart, end: monthEnd }) : eachDayOfInterval({ start: weekStart, end: weekEnd })
  const rangedEntries = view === 'list' ? filtered : filtered.filter((entry) => isWithinInterval(new Date(entry.queueItem.scheduledAt), { start: view === 'month' ? monthStart : weekStart, end: view === 'month' ? monthEnd : weekEnd }))
  const counters = { scheduled: allEntries.filter((entry) => entry.content.status === 'scheduled').length, published: allEntries.filter((entry) => entry.content.status === 'published').length, failed: allEntries.filter((entry) => entry.content.status === 'failed').length, draft: contents.filter((content) => content.status === 'draft').length, awaiting: contents.filter((content) => content.status === 'awaiting_approval').length }
  const periodLabel = view === 'month' ? format(anchor, 'MMMM yyyy', { locale: ptBR }) : `${format(weekStart, "dd 'de' MMM", { locale: ptBR })} — ${format(weekEnd, "dd 'de' MMM", { locale: ptBR })}`

  const closeAdd = () => { setAddDate(undefined); if (params.has('add')) { const next = new URLSearchParams(params); next.delete('add'); setParams(next, { replace: true }) } }
  const navigatePeriod = (amount: number) => setAnchor((date) => view === 'month' ? (amount > 0 ? addMonths(date, 1) : subMonths(date, 1)) : (amount > 0 ? addWeeks(date, 1) : subWeeks(date, 1)))
  const clearFilters = () => { setSearch(''); setStatus('all'); setFormatFilter('all'); setSource('all'); setNetwork('all') }
  const duplicate = async (contentId: string) => { await dispatch(duplicateContent({ id: contentId, userId: user.id })); setNotice('Uma cópia foi adicionada à biblioteca.') }
  const retry = async (entry: CalendarEntry) => { await dispatch(retryQueue(entry.queueItem.id)); setNotice('A publicação foi enviada novamente para processamento.') }
  const publishNow = async (entry: CalendarEntry) => { await dispatch(publishQueueItem({ id: entry.queueItem.id, userId: user.id })); setNotice('Publicação concluída agora na simulação.') }
  const remove = async () => { if (!deleteEntry) return; await dispatch(deleteContentItem({ id: deleteEntry.content.id, userId: user.id })); setDeleteEntry(undefined); setNotice('Conteúdo excluído e agendamento cancelado.') }
  const openSchedule = (entry: CalendarEntry) => navigate(`/content/${entry.content.id}?tab=schedule`)
  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || typeof over.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(over.id)) return
    const item = queue.find((entry) => entry.id === active.id)
    if (!item) return
    const time = format(new Date(item.scheduledAt), 'HH:mm')
    const next = new Date(`${over.id}T${time}:00`)
    if (next <= new Date()) { setNotice('Não é possível mover uma publicação para um horário passado.'); return }
    await dispatch(rescheduleQueueItem({ id: item.id, userId: user.id, scheduledAt: next.toISOString() }))
    setNotice(`Conteúdo movido para ${format(next, "dd/MM 'às' HH:mm")}.`)
  }
  const duplicateWeek = async () => {
    const current = allEntries.filter((entry) => isWithinInterval(new Date(entry.queueItem.scheduledAt), { start: weekStart, end: weekEnd }))
    for (const entry of current) { const copy = await dispatch(duplicateContent({ id: entry.content.id, userId: user.id })).unwrap(); await dispatch(scheduleContent({ userId: user.id, contentId: copy.id, scheduledAt: addDays(new Date(entry.queueItem.scheduledAt), 7).toISOString() })) }
    setNotice(`${current.length} conteúdo(s) duplicado(s) para a próxima semana.`)
  }
  const cardProps = (entry: CalendarEntry) => ({ onEdit: () => navigate(`/content/${entry.content.id}/edit`), onView: () => navigate(`/content/${entry.content.id}`), onDuplicate: () => void duplicate(entry.content.id), onRetry: () => void retry(entry), onDelete: () => setDeleteEntry(entry), onPublishNow: () => void publishNow(entry), onReschedule: () => openSchedule(entry) })

  return <div className="mobile-safe">
    <PageHeader eyebrow="Calendário editorial" title="Organize sua semana em poucos minutos" description="Crie, reutilize, mova e acompanhe conteúdos sem sair do calendário." action={<Button onClick={() => setAddDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}><Plus size={17} />Novo conteúdo</Button>} />
    {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}
    {inProgressPlans.length > 0 && <Card className="mb-4 p-4"><div className="flex flex-wrap items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-app-soft text-app-primary"><Loader2 className="animate-spin" size={17} /></span><b className="text-sm">Planejamento em andamento:</b><div className="flex flex-1 flex-wrap gap-2">{inProgressPlans.map((plan) => <button key={plan.planId} onClick={() => navigate(`/planning/${plan.planId}`)} className="surface-subtle flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:border-violet-400"><span>Semana de {format(new Date(`${plan.weekStart}T12:00:00`), 'dd/MM')}</span><span className="text-muted text-xs">{plan.completed + plan.failed}/{plan.total}</span><ChevronRight size={14} /></button>)}</div></div></Card>}
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[
      { key: 'scheduled', label: 'Agendados', value: counters.scheduled, tone: 'text-app-primary' }, { key: 'published', label: 'Publicados', value: counters.published, tone: 'text-green-500' }, { key: 'failed', label: 'Falharam', value: counters.failed, tone: 'text-red-500' }, { key: 'draft', label: 'Rascunhos', value: counters.draft, tone: 'text-app-muted' }, { key: 'awaiting_approval', label: 'Aguardando', value: counters.awaiting, tone: 'text-amber-500' },
    ].map((item) => <button key={item.key} onClick={() => item.key === 'draft' || item.key === 'awaiting_approval' ? navigate(`/content/library?status=${item.key}`) : setStatus(item.key as ContentStatus)} className="surface-card p-3 text-left"><span className="text-muted block text-[9px] font-bold uppercase">{item.label}</span><b className={`mt-1 block text-xl ${item.tone}`}>{item.value}</b></button>)}</div>
    <Card className="mb-4 p-3 sm:p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><Segmented value={view} onChange={setView} items={[{ value: 'week', label: 'Semana' }, { value: 'month', label: 'Mês' }, { value: 'list', label: 'Lista' }]} /><div className="flex items-center justify-center gap-2 xl:ml-2"><button className="icon-button" onClick={() => navigatePeriod(-1)} aria-label="Período anterior"><ChevronLeft size={17} /></button><b className="min-w-44 text-center text-sm capitalize">{periodLabel}</b><button className="icon-button" onClick={() => navigatePeriod(1)} aria-label="Próximo período"><ChevronRight size={17} /></button></div><div className="flex flex-wrap gap-2 xl:ml-auto"><Button variant="secondary" onClick={() => navigate('/planning/new')}><Sparkles size={16} />Planejar semana</Button><Button variant="secondary" onClick={() => void duplicateWeek()}><Copy size={16} />Duplicar semana</Button><Button variant="secondary" onClick={() => navigate('/planning/history')}><History size={16} />Histórico</Button></div></div></Card>
    <Card className="mb-4 p-3"><div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[1fr_150px_150px_150px_180px_auto]"><label className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted" size={16} /><input className="field pl-10" placeholder="Pesquisar título" value={search} onChange={(event) => setSearch(event.target.value)} /></label><Select value={status} onChange={(event) => setStatus(event.target.value as ContentStatus | 'all')}><option value="all">Todos os status</option><option value="awaiting_approval">Aguardando</option><option value="scheduled">Agendados</option><option value="published">Publicados</option><option value="failed">Falharam</option><option value="paused">Pausados</option></Select><Select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as ContentFormat | 'all')}><option value="all">Formatos</option><option value="post">Post</option><option value="carousel">Carrossel</option><option value="story">Story</option><option value="reel">Reels</option><option value="video">Vídeo</option></Select><Select value={source} onChange={(event) => setSource(event.target.value as ContentSource | 'all')}><option value="all">Origens</option><option value="ai">IA</option><option value="manual">Manual</option><option value="upload">Upload</option><option value="reused">Reutilizado</option></Select><Select value={network} onChange={(event) => setNetwork(event.target.value)}><option value="all">Todas as redes</option><option value="social-instagram">Instagram</option><option value="social-facebook">Facebook</option></Select><Button variant="secondary" onClick={clearFilters}><FilterX size={16} />Limpar</Button></div></Card>
    <DndContext sensors={sensors} onDragEnd={(event) => void dragEnd(event)}>{view === 'list' ? (rangedEntries.length ? <div className="space-y-3">{rangedEntries.slice().sort((a, b) => a.queueItem.scheduledAt.localeCompare(b.queueItem.scheduledAt)).map((entry) => <Card key={entry.queueItem.id} className="p-3"><CalendarContentCard content={entry.content} queueItem={entry.queueItem} {...cardProps(entry)} /></Card>)}</div> : <EmptyState icon={<List />} title="Nenhum conteúdo encontrado" description="Limpe os filtros ou adicione uma nova publicação." action={<Button onClick={() => setAddDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}>Adicionar conteúdo</Button>} />) : <div className={view === 'month' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7' : 'grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-7'}>{visibleDays.map((day) => <CalendarDay key={day.toISOString()} day={day} entries={entriesForDay(rangedEntries, day)} monthMode={view === 'month'} onAdd={() => setAddDate(format(day, 'yyyy-MM-dd'))} onEdit={(content) => navigate(`/content/${content.id}/edit`)} onView={(content) => navigate(`/content/${content.id}`)} onDuplicate={(content) => void duplicate(content.id)} onRetry={(entry) => void retry(entry)} onDelete={(entry) => setDeleteEntry(entry)} onPublishNow={(entry) => void publishNow(entry)} onReschedule={openSchedule} />)}</div>}</DndContext>
    {!allEntries.length && <div className="mt-4"><EmptyState icon={<CalendarDays />} title="Sua semana ainda está vazia" description="Adicione seu primeiro conteúdo ou deixe o Lumipost criar uma sugestão de planejamento para você." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setAddDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}>Adicionar conteúdo</Button><Button variant="secondary" onClick={() => navigate('/planning/new')}>Planejar semana com IA</Button></div>} /></div>}
    <AddContentModal open={Boolean(addDate)} defaultDate={addDate} onClose={closeAdd} onComplete={() => setNotice('Conteúdo adicionado ao calendário.')} />
    <ConfirmDialog open={Boolean(deleteEntry)} title="Excluir esta publicação?" description="O conteúdo será removido da biblioteca e o agendamento será cancelado." confirmLabel="Excluir" destructive onCancel={() => setDeleteEntry(undefined)} onConfirm={() => void remove()} />
  </div>
}
