import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

interface BaseProps {
  label: string
  options: string[]
  placeholder?: string
  description?: string
}

function useCombobox(options: string[], query: string) {
  return useMemo(() => {
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return options
    return options.filter((option) => normalize(option).includes(normalizedQuery))
  }, [options, query])
}

export function IdentityMultiCombobox({ label, options, value, onChange, placeholder = 'Pesquisar opções...', description, maxSelected = 8 }: BaseProps & { value: string[]; onChange: (value: string[]) => void; maxSelected?: number }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const filtered = useCombobox(options, query)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const toggle = (option: string) => {
    if (value.includes(option)) onChange(value.filter((item) => item !== option))
    else if (value.length < maxSelected) onChange([...value, option])
    setQuery('')
    inputRef.current?.focus()
  }

  return <div ref={rootRef} className="relative">
    <div className="mb-1.5 flex items-end justify-between gap-3"><label className="block text-sm font-semibold" htmlFor={`${listId}-input`}>{label}</label><span className="text-muted text-[10px]">{value.length}/{maxSelected}</span></div>
    <div className={`field flex min-h-12 flex-wrap items-center gap-1.5 !py-2 ${open ? '!border-app-primary ring-2 ring-violet-500/10' : ''}`} onClick={() => { setOpen(true); inputRef.current?.focus() }}>
      {value.map((item) => <span key={item} className="inline-flex min-h-7 items-center gap-1 rounded-full bg-app-soft px-2.5 text-[11px] font-bold text-app-primary">{item}<button type="button" className="rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10" onClick={(event) => { event.stopPropagation(); onChange(value.filter((selected) => selected !== item)) }} aria-label={`Remover ${item}`}><X size={12} /></button></span>)}
      <input ref={inputRef} id={`${listId}-input`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" className="min-w-[130px] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-app-muted" placeholder={value.length ? 'Adicionar...' : placeholder} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1)) }} />
      <ChevronDown size={16} className={`shrink-0 text-app-muted transition ${open ? 'rotate-180' : ''}`} />
    </div>
    {description && <p className="text-muted mt-1.5 text-[11px]">{description}</p>}
    {open && <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface p-2 shadow-[var(--shadow-float)]">
      <div id={listId} role="listbox" aria-multiselectable="true" className="modal-scrollbar max-h-64 overflow-y-auto overscroll-contain">
        {filtered.length ? filtered.map((option) => {
          const selected = value.includes(option)
          const disabled = !selected && value.length >= maxSelected
          return <button type="button" role="option" aria-selected={selected} disabled={disabled} key={option} onClick={() => toggle(option)} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${selected ? 'bg-app-soft font-semibold text-app-primary' : 'hover:bg-app-elevated'} disabled:cursor-not-allowed disabled:opacity-35`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-app-primary bg-app-primary text-white' : 'border-app-border'}`}>{selected && <Check size={13} />}</span><span>{option}</span></button>
        }) : <div className="px-3 py-8 text-center"><Search className="mx-auto text-app-muted" size={20} /><p className="text-muted mt-2 text-xs">Nenhuma opção encontrada.</p></div>}
      </div>
    </div>}
  </div>
}

export function IdentityCombobox({ label, options, value, onChange, placeholder = 'Pesquisar opções...', description, allowCustom = false }: BaseProps & { value: string; onChange: (value: string) => void; allowCustom?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const filtered = useCombobox(options, query)
  const trimmedQuery = query.trim()
  const hasExactMatch = filtered.some((option) => normalize(option) === normalize(trimmedQuery))
  const showCustomOption = allowCustom && trimmedQuery.length > 0 && !hasExactMatch
  const commitCustom = () => { onChange(trimmedQuery); setQuery(''); setOpen(false) }

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return <div ref={rootRef} className="relative">
    <label className="mb-1.5 block text-sm font-semibold" htmlFor={`${listId}-input`}>{label}</label>
    <div className={`field flex min-h-12 items-center gap-2 !py-2 ${open ? '!border-app-primary ring-2 ring-violet-500/10' : ''}`} onClick={() => { setOpen(true); inputRef.current?.focus() }}>
      <Search size={16} className="shrink-0 text-app-muted" />
      <input ref={inputRef} id={`${listId}-input`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-app-muted" placeholder={placeholder} value={open ? query : value} onFocus={() => { setQuery(''); setOpen(true) }} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && showCustomOption) { event.preventDefault(); commitCustom() } }} />
      {value && <button type="button" className="rounded-full p-1 text-app-muted hover:bg-app-elevated" aria-label={`Limpar ${label}`} onClick={(event) => { event.stopPropagation(); onChange(''); setQuery('') }}><X size={14} /></button>}
      <ChevronDown size={16} className={`shrink-0 text-app-muted transition ${open ? 'rotate-180' : ''}`} />
    </div>
    {description && <p className="text-muted mt-1.5 text-[11px]">{description}</p>}
    {open && <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface p-2 shadow-[var(--shadow-float)]">
      <div id={listId} role="listbox" className="modal-scrollbar max-h-64 overflow-y-auto overscroll-contain">
        {showCustomOption && <button type="button" role="option" aria-selected={false} onClick={commitCustom} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-app-primary hover:bg-app-elevated">Usar &ldquo;{trimmedQuery}&rdquo;</button>}
        {filtered.length ? filtered.map((option) => <button type="button" role="option" aria-selected={value === option} key={option} onClick={() => { onChange(option); setQuery(''); setOpen(false) }} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm transition ${value === option ? 'bg-app-soft font-semibold text-app-primary' : 'hover:bg-app-elevated'}`}><span>{option}</span>{value === option && <Check size={15} />}</button>) : !showCustomOption && <div className="px-3 py-8 text-center"><Search className="mx-auto text-app-muted" size={20} /><p className="text-muted mt-2 text-xs">Nenhuma opção encontrada.</p></div>}
      </div>
    </div>}
  </div>
}
