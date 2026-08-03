import { useEffect, useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ContentSource } from '../../../domain/models'
import { Button, Modal } from '../../../presentation/ui'
import { AiContentWizard } from '../../aiGeneration/components/AiContentWizard'
import { ContentSourceSelector } from '../../content/components/ContentSourceSelector'
import { ManualContentEditor } from '../../content/editor/ManualContentEditor'
import { LibraryContentSelector } from '../../content/library/LibraryContentSelector'
import type { PreparedContent } from '../../content/types'
import { ContentUploader } from '../../content/uploader/ContentUploader'
import { ScheduleDrawer } from '../../scheduling/components/ScheduleDrawer'

type FlowSource = Exclude<ContentSource, 'reused'>

export function AddContentModal({ open, defaultDate, initialSource, onClose, onComplete }: { open: boolean; defaultDate?: string; initialSource?: FlowSource; onClose: () => void; onComplete?: (contentId: string, scheduled: boolean) => void }) {
  const [source, setSource] = useState<FlowSource | undefined>(initialSource)
  const [prepared, setPrepared] = useState<PreparedContent>()
  const [success, setSuccess] = useState<{ id: string; scheduled: boolean }>()
  useEffect(() => { if (open) { setSource(initialSource); setPrepared(undefined); setSuccess(undefined) } }, [defaultDate, initialSource, open])
  const finish = (id: string, scheduled: boolean) => { setSuccess({ id, scheduled }); onComplete?.(id, scheduled) }
  const reset = () => { setSource(undefined); setPrepared(undefined); setSuccess(undefined) }
  const title = success ? 'Tudo pronto' : prepared ? 'Revisar e agendar' : source === 'ai' ? 'Criar com IA' : source === 'manual' ? 'Criar manualmente' : source === 'upload' ? 'Enviar conteúdo pronto' : source === 'library' ? 'Selecionar da biblioteca' : 'Adicionar conteúdo'
  return <Modal open={open} onClose={onClose} title={title} wide>{success ? <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-72 flex-col items-center justify-center text-center"><span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/12 text-green-500"><CheckCircle2 size={40} /></span><h3 className="text-2xl font-bold">{success.scheduled ? 'Publicação agendada!' : 'Rascunho salvo!'}</h3><p className="text-muted mt-2 max-w-md text-sm">{success.scheduled ? 'O conteúdo já aparece no calendário e será publicado no horário definido.' : 'Você poderá continuar a edição ou agendar este conteúdo pela biblioteca.'}</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={reset}><Plus size={16} />Adicionar outro</Button><Button onClick={onClose}>Voltar ao calendário</Button></div></motion.div> : prepared ? <ScheduleDrawer content={prepared} defaultDate={defaultDate} onBack={() => setPrepared(undefined)} onComplete={finish} /> : !source ? <ContentSourceSelector onSelect={setSource} /> : source === 'ai' ? <AiContentWizard onReady={setPrepared} onBack={() => setSource(undefined)} /> : source === 'manual' ? <ManualContentEditor onReady={setPrepared} onBack={() => setSource(undefined)} /> : source === 'upload' ? <ContentUploader onReady={setPrepared} onBack={() => setSource(undefined)} /> : <LibraryContentSelector onReady={setPrepared} onBack={() => setSource(undefined)} />}</Modal>
}
