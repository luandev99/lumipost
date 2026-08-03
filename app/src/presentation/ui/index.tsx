import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Loader2, Moon, Sun, X } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { uiActions } from '../store/store'

export function BrandMark({ compact = false }: { compact?: boolean }) { return <div className="flex items-center gap-2.5"><img src="/assets/icon.png" alt="lumipost" className={`${compact ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl'} object-contain`} /><span className={`${compact ? 'text-[16px]' : 'text-[20px]'} font-bold tracking-tight`}>lumi<span className="text-app-primary">post</span></span></div> }
export function ThemeToggle() { const dispatch = useAppDispatch(); const theme = useAppSelector((state) => state.ui.theme); return <button className="icon-button" onClick={() => dispatch(uiActions.toggleTheme())} aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button> }
export function Button({ children, variant = 'primary', loading, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; loading?: boolean }) { return <button className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`} disabled={loading || props.disabled} {...props}>{loading && <Loader2 size={17} className="animate-spin" />}{children}</button> }
export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input className="field" {...props} />{error && <span className="mt-1.5 block text-xs text-red-500">{error}</span>}</label> }
export function Textarea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><textarea className="field min-h-24 resize-y" {...props} /></label> }
export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><select className="field" {...props}>{children}</select></label> }
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`surface-card ${className}`}>{children}</div> }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }) { const colors = { neutral: 'bg-black/5 dark:bg-white/8 text-app-muted', primary: 'bg-app-soft text-app-primary', success: 'bg-green-500/10 text-green-600 dark:text-green-400', warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', danger: 'bg-red-500/10 text-red-600 dark:text-red-400' }; return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${colors[tone]}`}>{children}</span> }
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row"><div>{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="text-muted mt-1.5 max-w-xl text-sm leading-relaxed">{description}</p>}</div>{action && <div className="shrink-0">{action}</div>}</div> }
export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) { return <div className="surface-subtle flex flex-col items-center px-6 py-12 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-app-soft text-app-primary">{icon}</div><h3 className="font-bold">{title}</h3><p className="text-muted mt-1 max-w-sm text-sm">{description}</p>{action && <div className="mt-5">{action}</div>}</div> }
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error'; children: ReactNode }) { const styles = tone === 'error' ? 'border-red-300/50 bg-red-500/10 text-red-600 dark:text-red-300' : tone === 'success' ? 'border-green-300/50 bg-green-500/10 text-green-700 dark:text-green-300' : 'border-violet-300/40 bg-violet-500/10 text-app-primary'; return <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${styles}`}>{tone === 'success' ? <Check size={18} /> : tone === 'error' ? <AlertTriangle size={18} /> : null}<div>{children}</div></div> }
export function Modal({ open, title, children, onClose, wide = false }: { open: boolean; title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="modal-overlay fixed inset-0 z-[9999] isolate flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal-panel animate-fade-up relative flex w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-app-border bg-app-surface text-app-text shadow-[0_32px_120px_-24px_rgba(0,0,0,.95)] outline-none dark:border-white/10 dark:bg-[#0d0d0f] sm:rounded-[1.75rem] ${wide ? 'max-w-5xl' : 'max-w-lg'}`}>
        <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-app-border bg-app-surface/95 px-5 py-4 backdrop-blur-xl dark:border-white/8 dark:bg-[#0d0d0f]/95 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button className="icon-button shrink-0" onClick={onClose} aria-label="Fechar modal"><X size={18} /></button>
        </div>
        <div className="modal-content modal-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', destructive = false, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) { return <Modal open={open} onClose={onCancel} title={title}><p className="text-muted text-sm leading-relaxed">{description}</p><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><button className={destructive ? 'btn-primary !bg-red-600' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button></div></Modal> }
export function Segmented<T extends string>({ value, items, onChange }: { value: T; items: { value: T; label: string }[]; onChange: (value: T) => void }) { return <div className="flex rounded-full border border-app-border bg-app-elevated p-1">{items.map((item) => <button key={item.value} type="button" onClick={() => onChange(item.value)} className={`min-h-10 flex-1 rounded-full px-3 text-sm font-semibold transition ${value === item.value ? 'bg-app-surface text-app-primary shadow-sm' : 'text-app-muted'}`}>{item.label}</button>)}</div> }
