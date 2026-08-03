-- Generaliza weekly_slots para também suportar a criação avulsa de um único
-- conteúdo (fora do planejamento semanal): guarda o rascunho completo já
-- revisado pelo usuário (título, legenda, roteiro etc.) e permite
-- scheduled_at nulo (rascunho sem agendamento ainda).

alter table public.weekly_slots
  add column draft jsonb not null default '{}'::jsonb;

alter table public.weekly_slots
  alter column scheduled_at drop not null;
