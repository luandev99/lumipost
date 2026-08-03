import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, CalendarClock, Copy, Eye, GripVertical, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Content, QueueItem } from '../../../domain/models'
import { ContentPreview } from '../../../presentation/components/TemplateRenderer'
import { useAppSelector } from '../../../presentation/store/hooks'
import { connectedInstagramAccount } from '../../../presentation/utils/instagramGuard'
import { ContentFormatBadge, ContentSourceBadge, ContentStatusBadge } from '../../content/components/ContentBadges'

interface Props {
  content: Content
  queueItem: QueueItem
  onEdit: () => void
  onView: () => void
  onDuplicate: () => void
  onRetry: () => void
  onDelete?: () => void
  onPublishNow?: () => void
  onReschedule?: () => void
  compact?: boolean
}

export function CalendarContentCard({ content, queueItem, onEdit, onView, onDuplicate, onRetry, onDelete, onPublishNow, onReschedule, compact = false }: Props) {
  const instagramAccount = connectedInstagramAccount(useAppSelector((state) => state.socialAccounts.items))
  const draggable = !['published', 'canceled'].includes(queueItem.status)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: queueItem.id, disabled: !draggable })
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={`group min-w-0 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-2.5 shadow-sm transition ${isDragging ? 'z-50 rotate-1 opacity-70 shadow-2xl' : 'hover:border-violet-400'} ${compact ? 'text-[11px]' : ''}`}>
    <div className="flex min-w-0 items-center gap-1.5"><button className="shrink-0 cursor-grab touch-none text-app-muted disabled:cursor-default" disabled={!draggable} {...listeners} {...attributes} aria-label="Mover conteúdo"><GripVertical size={14} /></button><b className="shrink-0 text-[11px] text-app-primary">{format(new Date(queueItem.scheduledAt), 'HH:mm')}</b><span className="min-w-0 overflow-hidden"><ContentStatusBadge status={content.status} /></span></div>
    <div className="mt-2 flex min-w-0 items-start gap-2"><div className={`shrink-0 items-center justify-center overflow-hidden rounded-lg bg-app-elevated ${compact ? 'hidden' : 'flex h-12 w-10'}`}><ContentPreview content={content} width={content.format === 'story' || content.format === 'reel' ? 28 : 38} /></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-bold leading-snug">{content.title}</p><p className="text-muted mt-1 truncate text-[9px]">Instagram{instagramAccount?.handle ? ` · @${instagramAccount.handle}` : ''}</p><div className="mt-2 flex flex-wrap gap-1"><ContentFormatBadge format={content.format} /><ContentSourceBadge source={content.source} /></div></div></div>
    {content.status === 'failed' && <div className="mt-2 rounded-xl bg-red-500/10 p-2 text-[10px] text-red-600 dark:text-red-300"><div className="flex items-center gap-1 font-bold"><AlertTriangle size={11} />Falha ao publicar</div><p className="mt-0.5">A conexão com o Instagram expirou.</p><button onClick={onRetry} className="mt-1 font-bold underline">Tentar novamente</button></div>}
    <div className="mt-2 grid grid-cols-4 gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100"><button className="flex h-7 items-center justify-center rounded-full hover:bg-app-elevated" onClick={onEdit} title="Editar"><Pencil size={12} /></button><button className="flex h-7 items-center justify-center rounded-full hover:bg-app-elevated" onClick={onDuplicate} title="Duplicar"><Copy size={12} /></button>{onReschedule && <button className="flex h-7 items-center justify-center rounded-full hover:bg-app-elevated" onClick={onReschedule} title="Reagendar"><CalendarClock size={12} /></button>}<button className="flex h-7 items-center justify-center rounded-full hover:bg-app-elevated" onClick={onView} title="Visualizar"><Eye size={12} /></button>{onPublishNow && queueItem.status !== 'published' && <button className="flex h-7 items-center justify-center rounded-full hover:bg-app-elevated" onClick={onPublishNow} title="Publicar agora"><Send size={12} /></button>}{content.status === 'failed' && <button className="flex h-7 items-center justify-center rounded-full hover:bg-app-elevated" onClick={onRetry} title="Tentar novamente"><RotateCcw size={12} /></button>}{onDelete && <button className="flex h-7 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" onClick={onDelete} title="Excluir"><Trash2 size={12} /></button>}</div>
  </div>
}
