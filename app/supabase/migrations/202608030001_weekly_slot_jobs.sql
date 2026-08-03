-- Progresso persistido do planejamento semanal: weekly_slots ganha uma
-- máquina de estados própria e um worker em background a processa, para que
-- a geração sobreviva a F5/fechar aba (antes só existia em memória no
-- navegador).

alter table public.weekly_slots
  add column status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  add column attempts integer not null default 0,
  add column locked_at timestamptz,
  add column error_code text,
  add column updated_at timestamptz not null default now();

create index weekly_slots_status_idx on public.weekly_slots(status)
  where status in ('pending', 'processing');

create trigger weekly_slots_updated_at before update on public.weekly_slots
for each row execute function app_private.set_updated_at();

-- Reivindica slots pendentes para o worker de geração. Mesmo padrão de
-- claim_due_publishing_jobs_service (FOR UPDATE SKIP LOCKED), sem retry
-- automático: uma falha de geração de IA fica "failed" e só volta a
-- "pending" por ação manual (botão "Tentar novamente"), para não recobrar
-- créditos automaticamente por um erro determinístico.
create or replace function public.claim_due_weekly_slots_service(batch_size integer default 10)
returns setof public.weekly_slots language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if batch_size < 1 or batch_size > 25 then raise exception 'INVALID_BATCH_SIZE'; end if;
  return query
  with due as (
    select s.id
    from public.weekly_slots s
    where s.status = 'pending'
      and (s.locked_at is null or s.locked_at < now() - interval '10 minutes')
    order by s.created_at
    for update skip locked
    limit batch_size
  )
  update public.weekly_slots slot set
    status = 'processing',
    attempts = slot.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from due where slot.id = due.id
  returning slot.*;
end;
$$;

revoke execute on function public.claim_due_weekly_slots_service(integer) from public, anon, authenticated;
grant execute on function public.claim_due_weekly_slots_service(integer) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.weekly_slots;
exception when duplicate_object then null;
end $$;

select cron.schedule(
  'lumipost-process-weekly-slots',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/process-weekly-slots',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publish_worker_secret'
        limit 1
      )
    ),
    body := '{"batchSize":5}'::jsonb
  );
  $cron$
);
