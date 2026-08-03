-- Geração real de vídeo via Higgsfield (image2video/dop), assíncrona:
-- submit acontece na geração do conteúdo, um worker em background (cron)
-- consulta o status até ficar pronto. Sem retry automático — falha fica
-- terminal, mesma filosofia dos outros jobs desta sessão.

create table public.video_generation_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  provider text not null default 'higgsfield',
  provider_request_id text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 0,
  locked_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_request_id)
);
create index video_generation_jobs_status_idx on public.video_generation_jobs(status)
  where status = 'processing';

create trigger video_generation_jobs_updated_at before update on public.video_generation_jobs
for each row execute function app_private.set_updated_at();

alter table public.video_generation_jobs enable row level security;
alter table public.video_generation_jobs force row level security;

create policy video_generation_jobs_select_member on public.video_generation_jobs
for select to authenticated using (app_private.is_org_member(organization_id));

revoke all on public.video_generation_jobs from public, anon, authenticated;
grant select on public.video_generation_jobs to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.video_generation_jobs;
exception when duplicate_object then null;
end $$;

-- Reivindica jobs pendentes para o worker de polling (mesmo padrão de
-- claim_due_weekly_slots_service / claim_due_publishing_jobs_service).
create or replace function public.claim_video_generation_jobs_service(batch_size integer default 10)
returns setof public.video_generation_jobs language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if batch_size < 1 or batch_size > 25 then raise exception 'INVALID_BATCH_SIZE'; end if;
  return query
  with due as (
    select j.id
    from public.video_generation_jobs j
    where j.status = 'processing'
      and (j.locked_at is null or j.locked_at < now() - interval '2 minutes')
    order by j.created_at
    for update skip locked
    limit batch_size
  )
  update public.video_generation_jobs job set
    attempts = job.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from due where job.id = due.id
  returning job.*;
end;
$$;

revoke execute on function public.claim_video_generation_jobs_service(integer) from public, anon, authenticated;
grant execute on function public.claim_video_generation_jobs_service(integer) to service_role;

select cron.schedule(
  'lumipost-poll-video-jobs',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/poll-video-jobs',
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
