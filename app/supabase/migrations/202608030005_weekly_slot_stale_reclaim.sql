-- claim_due_weekly_slots_service só reivindicava status='pending': uma vez
-- que um slot virava 'processing', se a Edge Function morresse no meio
-- (timeout de execução, geração de carrossel com várias imagens sequenciais
-- passando do limite da plataforma), o slot ficava travado em 'processing'
-- para sempre — sem retry automático nem botão de retry manual na UI (que só
-- aparece para status='failed'). Agora reivindica também 'processing' com
-- lock antigo, igual ao padrão já usado em claim_video_generation_jobs_service.

create or replace function public.claim_due_weekly_slots_service(batch_size integer default 10)
returns setof public.weekly_slots language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if batch_size < 1 or batch_size > 25 then raise exception 'INVALID_BATCH_SIZE'; end if;
  return query
  with due as (
    select s.id
    from public.weekly_slots s
    where s.status in ('pending', 'processing')
      and (s.locked_at is null or s.locked_at < now() - interval '5 minutes')
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
