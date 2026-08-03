import { Check, Sparkles } from 'lucide-react'

const steps = ['Analisando o perfil da marca', 'Selecionando a estratégia', 'Criando o roteiro', 'Gerando a arte', 'Preparando a legenda', 'Finalizando o conteúdo']

export function GenerationProgress() {
  return <div className="generation-thinking-card surface-subtle relative overflow-hidden p-4"><div className="generation-inline-glow" /><div className="relative z-10"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-soft text-app-primary"><Sparkles size={18} /></span><div className="flex-1"><b className="block text-sm">Criando suas opções</b><span className="text-muted text-xs">Estratégia, texto e visual estão sendo combinados.</span></div><div className="generation-dots" aria-label="Gerando"><span /><span /><span /></div></div><div className="grid gap-2 sm:grid-cols-2">{steps.map((step, index) => <div key={step} className="generation-step flex items-center gap-2 text-xs" style={{ animationDelay: `${index * .16}s` }}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-app-soft text-app-primary"><Check size={11} /></span>{step}</div>)}</div></div></div>
}
