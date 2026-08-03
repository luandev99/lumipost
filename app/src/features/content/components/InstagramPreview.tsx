import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import type { Content } from '../../../domain/models'
import type { PreparedContent } from '../types'
import { ContentPreview } from '../../../presentation/components/TemplateRenderer'

function toContent(value: PreparedContent): Content {
  return {
    id: value.existingId ?? 'preview',
    userId: 'preview',
    title: value.title || 'Sua publicação',
    format: value.format,
    source: value.source,
    status: 'draft',
    topic: value.topic,
    caption: value.caption,
    hashtags: value.hashtags,
    cta: value.cta,
    createdAt: new Date().toISOString(),
    mediaUrls: value.mediaUrls,
    slideTexts: value.slideTexts,
  }
}

export function InstagramPreview({ content, mode = 'feed', handle, avatarUrl }: { content: PreparedContent | Content; mode?: 'feed' | 'story' | 'reel'; handle?: string; avatarUrl?: string }) {
  const normalized = 'createdAt' in content ? content : toContent(content)
  const displayHandle = handle || 'sua_conta'
  const avatar = avatarUrl
    ? <img src={avatarUrl} alt={displayHandle} className="h-full w-full object-cover" />
    : null
  if (mode === 'story' || mode === 'reel') {
    return <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[2rem] border-[6px] border-black bg-black shadow-2xl"><div className="relative aspect-[9/16] overflow-hidden bg-app-elevated"><ContentPreview content={{ ...normalized, format: mode === 'story' ? 'story' : 'reel' }} width={280} className="h-full w-full" interactive /><div className="absolute left-3 right-3 top-3 flex items-center gap-2 text-white"><span className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-violet-400 to-purple-700">{avatar}</span><b className="text-xs">{displayHandle}</b><span className="text-[10px] opacity-70">2 h</span></div></div></div>
  }
  return <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[1.7rem] border border-app-border bg-app-surface shadow-[var(--shadow-card)]"><div className="flex items-center gap-3 px-4 py-3"><span className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-violet-400 to-purple-700">{avatar}</span><div className="min-w-0 flex-1"><b className="block text-xs">{displayHandle}</b>{normalized.location && <span className="text-muted block truncate text-[10px]">{normalized.location}</span>}</div><MoreHorizontal size={18} /></div><div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-app-elevated"><ContentPreview content={normalized} width={360} className="h-full w-full" interactive /></div><div className="px-4 pb-4 pt-3"><div className="flex items-center gap-4"><Heart size={21} /><MessageCircle size={21} /><Send size={20} /><Bookmark className="ml-auto" size={20} /></div><p className="mt-3 line-clamp-4 text-xs leading-relaxed"><b>{displayHandle} </b>{normalized.caption}</p><p className="mt-1 text-xs text-app-primary">{normalized.hashtags.join(' ')}</p></div></div>
}
