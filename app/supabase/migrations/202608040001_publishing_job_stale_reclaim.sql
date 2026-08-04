-- claim_due_publishing_jobs_service só reivindicava 'scheduled', 'queued' e
-- 'retry_scheduled'. Se o worker morresse depois de marcar o job como
-- 'publishing' (timeout da plataforma, restart do banco no meio da chamada à
-- Meta), o job ficava travado em 'publishing' para sempre: nenhum tick
-- posterior o recuperava e a UI não oferece retry manual nesse estado.
-- Aconteceu de verdade com 8 jobs durante um resize de compute.
--
-- Agora reivindica também 'publishing' com lock antigo, o mesmo padrão já
-- aplicado em claim_due_weekly_slots_service (202608030005) e
-- claim_video_generation_jobs_service. O filtro de locked_at continua
-- protegendo jobs realmente em andamento — só volta o que está parado há mais
-- de 10 minutos, bem acima do tempo normal de uma publicação.
--
-- Republicar um job travado pode duplicar o post quando a chamada à Meta
-- chegou a completar mas a resposta se perdeu. O risco é aceito: o caminho
-- normal grava external_post_id antes de concluir, e ficar preso em silêncio
-- é pior do que uma duplicata rara e visível.

create or replace function public.claim_due_publishing_jobs_service(batch_size integer default 10)
returns setof public.publishing_jobs language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if batch_size < 1 or batch_size > 25 then raise exception 'INVALID_BATCH_SIZE'; end if;
  return query
  with due as (
    select j.id
    from public.publishing_jobs j
    where j.status in ('scheduled', 'queued', 'retry_scheduled', 'publishing')
      and coalesce(j.next_attempt_at, j.scheduled_at) <= now()
      and j.attempts < j.max_attempts
      and (j.locked_at is null or j.locked_at < now() - interval '10 minutes')
    order by coalesce(j.next_attempt_at, j.scheduled_at), j.created_at
    for update skip locked
    limit batch_size
  )
  update public.publishing_jobs job set
    status = 'publishing',
    attempts = job.attempts + 1,
    locked_at = now(),
    lock_token = extensions.gen_random_uuid(),
    updated_at = now()
  from due where job.id = due.id
  returning job.*;
end;
$$;

revoke execute on function public.claim_due_publishing_jobs_service(integer) from public, anon, authenticated;
grant execute on function public.claim_due_publishing_jobs_service(integer) to service_role;
