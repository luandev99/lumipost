import { FileUp, Library, PencilLine, WandSparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ContentSource } from '../../../domain/models'

const options: { value: ContentSource; title: string; description: string; icon: typeof WandSparkles }[] = [
  { value: 'ai', title: 'Criar com IA', description: 'Use sua marca, objetivo e tema para gerar opções completas.', icon: WandSparkles },
  { value: 'manual', title: 'Criar manualmente', description: 'Monte mídia, texto, legenda e detalhes do seu jeito.', icon: PencilLine },
  { value: 'library', title: 'Selecionar da biblioteca', description: 'Reutilize um rascunho ou uma publicação anterior.', icon: Library },
  { value: 'upload', title: 'Enviar conteúdo pronto', description: 'Envie imagens, vídeos, carrosséis ou um Reels finalizado.', icon: FileUp },
]

export function ContentSourceSelector({ onSelect }: { onSelect: (source: Exclude<ContentSource, 'reused'>) => void }) {
  return <div><p className="text-muted mb-4 text-sm">O que você deseja adicionar?</p><div className="grid gap-3 sm:grid-cols-2">{options.map((option, index) => { const Icon = option.icon; return <motion.button key={option.value} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} whileHover={{ y: -2 }} onClick={() => onSelect(option.value as Exclude<ContentSource, 'reused'>)} className="surface-subtle group min-h-36 p-4 text-left transition hover:border-violet-400 hover:bg-app-soft"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary transition group-hover:bg-app-primary group-hover:text-white"><Icon size={20} /></span><b className="block">{option.title}</b><span className="text-muted mt-1 block text-xs leading-relaxed">{option.description}</span></motion.button> })}</div></div>
}
