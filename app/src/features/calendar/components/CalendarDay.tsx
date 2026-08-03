import { useDroppable } from '@dnd-kit/core'
import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import type { Content, QueueItem } from '../../../domain/models'
import { CalendarContentCard } from './CalendarContentCard'

export interface CalendarEntry { content: Content; queueItem: QueueItem }

interface Props {
  day: Date
  entries: CalendarEntry[]
  onAdd: () => void
  onEdit: (content: Content) => void
  onView: (content: Content) => void
  onDuplicate: (content: Content) => void
  onRetry: (entry: CalendarEntry) => void
  onDelete?: (entry: CalendarEntry) => void
  onPublishNow?: (entry: CalendarEntry) => void
  onReschedule?: (entry: CalendarEntry) => void
  monthMode?: boolean
}

export function CalendarDay({ day, entries, onAdd, onEdit, onView, onDuplicate, onRetry, onDelete, onPublishNow, onReschedule, monthMode = false }: Props) {
  const dateId = format(day, 'yyyy-MM-dd')
  const { setNodeRef, isOver } = useDroppable({ id: dateId })
  return <section ref={setNodeRef} className={`rounded-3xl border p-3 transition ${isOver ? 'border-app-primary bg-app-soft ring-2 ring-violet-300/40' : 'border-app-border bg-app-surface/75'} ${monthMode ? 'min-h-40' : 'min-h-48'}`}>
    <div className="mb-3 flex items-center justify-between"><div><span className="text-muted block text-[9px] font-bold uppercase">{format(day, 'EEE', { locale: ptBR })}</span><span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday(day) ? 'bg-app-primary text-white' : ''}`}>{format(day, 'dd')}</span></div><button onClick={onAdd} className="flex h-9 w-9 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-primary hover:border-app-primary" aria-label={`Adicionar conteúdo em ${format(day, 'dd/MM')}`}><Plus size={16} /></button></div>
    <div className="space-y-2">{entries.slice(0, monthMode ? 3 : undefined).map((entry) => <CalendarContentCard key={entry.queueItem.id} content={entry.content} queueItem={entry.queueItem} compact={monthMode} onEdit={() => onEdit(entry.content)} onView={() => onView(entry.content)} onDuplicate={() => onDuplicate(entry.content)} onRetry={() => onRetry(entry)} onDelete={onDelete ? () => onDelete(entry) : undefined} onPublishNow={onPublishNow ? () => onPublishNow(entry) : undefined} onReschedule={onReschedule ? () => onReschedule(entry) : undefined} />)}{monthMode && entries.length > 3 && <span className="text-muted block text-center text-[10px] font-bold">+{entries.length - 3} conteúdos</span>}{!entries.length && <button onClick={onAdd} className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-app-border text-[10px] font-bold text-app-muted hover:border-app-primary hover:text-app-primary"><Plus size={15} />Adicionar conteúdo</button>}</div>
  </section>
}
