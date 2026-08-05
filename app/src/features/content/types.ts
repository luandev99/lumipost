import type { Content, ContentFormat, ContentSource } from '../../domain/models'

export interface PreparedContent {
  existingId?: string
  duplicateBeforeSchedule?: boolean
  source: ContentSource
  title: string
  topic: string
  format: ContentFormat
  caption: string
  hashtags: string[]
  cta: string
  mediaUrls: string[]
  mediaFiles?: File[]
  slideTexts?: string[]
  reelScript?: Content['reelScript']
  slides?: number
  creditCost: number
  altText?: string
  location?: string
  link?: string
  firstComment?: string
  collaborators?: string[]
  taggedPeople?: string[]
  referenceImagePath?: string
  referenceMode?: 'base' | 'context'
}

export function contentToPrepared(content: Content, duplicateBeforeSchedule = true): PreparedContent {
  return {
    existingId: content.id,
    duplicateBeforeSchedule,
    source: duplicateBeforeSchedule ? 'reused' : content.source,
    title: content.title,
    topic: content.topic,
    format: content.format,
    caption: content.caption,
    hashtags: content.hashtags,
    cta: content.cta,
    mediaUrls: content.mediaUrls,
    slideTexts: content.slideTexts,
    reelScript: content.reelScript,
    slides: content.slideTexts?.length ?? 1,
    creditCost: 0,
    altText: content.altText,
    location: content.location,
    link: content.link,
    firstComment: content.firstComment,
    collaborators: content.collaborators,
    taggedPeople: content.taggedPeople,
  }
}
