-- Carrossel (5 imagens sequenciais) pode estourar o limite de execução da
-- Edge Function no meio da geração, deixando o slot travado em 'processing'.
-- O worker (process-weekly-slots) só devolvia isso pro cron depois de 5min
-- parado, e tentava de novo pra sempre sem limite — o card ficava "Gerando"
-- indefinidamente. O worker agora tem um teto de tentativas (MAX_ATTEMPTS)
-- que marca o slot como 'failed' de vez; aqui só reduzimos o intervalo de
-- lock travado de 5min para 2min, para esse ciclo de retry acontecer mais
-- rápido enquanto o teto de tentativas não é atingido.

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
      and (s.locked_at is null or s.locked_at < now() - interval '2 minutes')
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
