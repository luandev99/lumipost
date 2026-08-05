-- Slots de planejamento semanal criados antes do fix no frontend gravavam
-- scheduled_at como "day T local_time" sem offset (`repositories.ts`), o que
-- o Postgres lia como UTC — adiantando o horário real em 3h (Brasil = UTC-3).
-- day/local_time sempre estiveram corretos (são a fonte usada na UI); aqui
-- recalculamos scheduled_at a partir deles com o offset explícito, só para
-- slots ainda não concluídos, para não alterar histórico já publicado.

update public.weekly_slots
set scheduled_at = (day::text || 'T' || local_time::text || '-03:00')::timestamptz
where scheduled_at is not null
  and status in ('pending', 'processing', 'failed')
  and scheduled_at <> (day::text || 'T' || local_time::text || '-03:00')::timestamptz;
