import type { ContentFormat, ContentSource, ContentStatus } from '../../../domain/models'
import { formatLabels, statusLabels } from '../../../domain/models'
import { Badge } from '../../../presentation/ui'

const sourceLabels: Record<ContentSource, string> = { ai: 'IA', manual: 'Manual', upload: 'Upload', library: 'Biblioteca', reused: 'Reutilizado' }

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const tone = status === 'published' ? 'success' : status === 'failed' ? 'danger' : status === 'scheduled' || status === 'processing' || status === 'publishing' ? 'primary' : status === 'awaiting_approval' || status === 'paused' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{statusLabels[status]}</Badge>
}

export function ContentFormatBadge({ format }: { format: ContentFormat }) {
  return <Badge>{formatLabels[format]}</Badge>
}

export function ContentSourceBadge({ source }: { source: ContentSource }) {
  return <Badge tone={source === 'ai' ? 'primary' : source === 'upload' ? 'success' : 'neutral'}>{sourceLabels[source]}</Badge>
}
