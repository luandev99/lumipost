import { useEffect, useState } from 'react'
import { CalendarDays, GalleryHorizontalEnd, Image, Sparkles, Video } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ContentFormat, ContentSource } from '../../../domain/models'
import { formatLabels } from '../../../domain/models'
import { AI_VIDEO_GENERATION_ENABLED } from '../../../domain/featureFlags'
import { AddContentModal } from '../../calendar/components/AddContentModal'
import { Button, Card, PageHeader } from '../../../presentation/ui'
import { ContentSourceSelector } from '../components/ContentSourceSelector'

type FlowSource = Exclude<ContentSource, 'reused'>
const routeSources: Record<string, FlowSource> = { ai: 'ai', manual: 'manual', upload: 'upload', library: 'library' }
const formats: { value: ContentFormat; icon: typeof Image; description: string }[] = [
  { value: 'post', icon: Image, description: 'Imagem única para o feed' },
  { value: 'carousel', icon: GalleryHorizontalEnd, description: 'De 2 a 10 slides editáveis' },
  { value: 'story', icon: Sparkles, description: 'Conteúdo vertical e rápido' },
  ...(AI_VIDEO_GENERATION_ENABLED ? [{ value: 'reel' as const, icon: Video, description: 'Roteiro, capa e vídeo' }] : []),
]

export function ContentCreatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const segment = location.pathname.split('/').at(-1) ?? ''
  const routeSource = routeSources[segment]
  const [source, setSource] = useState<FlowSource | undefined>(routeSource)
  const [open, setOpen] = useState(Boolean(routeSource))
  useEffect(() => { if (routeSource) { setSource(routeSource); setOpen(true) } }, [routeSource])
  const launch = (next: FlowSource) => { setSource(next); setOpen(true) }
  return <div className="mobile-safe"><PageHeader eyebrow="Estúdio de conteúdo" title="Crie, reutilize ou envie" description="Todos os caminhos chegam à mesma revisão e ao mesmo agendamento — sem cobrar créditos antes da confirmação." action={<Button variant="secondary" onClick={() => navigate('/planning/new')}><CalendarDays size={17} />Planejar semana</Button>} /><Card className="mb-5 overflow-hidden p-5 sm:p-6"><div className="mb-4"><p className="eyebrow">Escolha a origem</p><h2 className="mt-1 text-xl font-bold">Como deseja começar?</h2></div><ContentSourceSelector onSelect={launch} /></Card><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">Formatos disponíveis</p><h2 className="mt-1 text-xl font-bold">Uma experiência para cada ideia</h2></div><span className="text-muted hidden text-xs sm:block">Post · Carrossel · Story · Reels</span></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{formats.map(({ value, icon: Icon, description }) => <button key={value} onClick={() => launch('ai')} className="surface-card min-h-36 p-4 text-left transition hover:-translate-y-1 hover:border-violet-400"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary"><Icon size={20} /></span><b>{formatLabels[value]}</b><span className="text-muted mt-1 block text-xs">{description}</span></button>)}</div><AddContentModal open={open} initialSource={source} onClose={() => { setOpen(false); if (routeSource) navigate('/content/create', { replace: true }) }} onComplete={() => {}} /></div>
}
