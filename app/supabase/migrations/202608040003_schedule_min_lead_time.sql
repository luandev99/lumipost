-- Agendamento manual precisa de pelo menos 1 hora de antecedência a partir de
-- agora, não só "no futuro" — evita agendar para daqui a 2 minutos, o que na
-- prática não dá tempo de a fila processar com folga.
create or replace function app_private.schedule_content(
  target_content uuid,
  target_scheduled_at timestamptz,
  target_timezone text,
  target_social_account uuid,
  idem_key text
)
returns table (job_id uuid, organization_id uuid, balance integer, reserved integer, available integer, version bigint)
language plpgsql security definer set search_path = '' as $$
declare
  selected_content public.contents;
  wallet public.credit_wallets;
  existing_job public.publishing_jobs;
  created_job public.publishing_jobs;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if target_scheduled_at < now() + interval '1 hour' then raise exception 'SCHEDULE_MUST_BE_AT_LEAST_1H_AHEAD'; end if;
  if char_length(idem_key) < 12 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select * into selected_content from public.contents
  where id = target_content and deleted_at is null;
  if not found or not app_private.has_org_role(selected_content.organization_id, array['owner','admin','editor']::public.member_role[]) then
    raise exception 'CONTENT_NOT_FOUND';
  end if;

  if target_social_account is not null and not exists (
    select 1 from public.social_accounts s
    where s.id = target_social_account and s.organization_id = selected_content.organization_id and s.status = 'active'
  ) then raise exception 'SOCIAL_ACCOUNT_NOT_FOUND'; end if;

  select * into wallet from public.credit_wallets
  where credit_wallets.organization_id = selected_content.organization_id for update;

  select * into existing_job from public.publishing_jobs p
  where p.organization_id = selected_content.organization_id and p.idempotency_key = idem_key;
  if found then
    return query select existing_job.id, wallet.organization_id, wallet.balance, wallet.reserved,
      wallet.balance - wallet.reserved, wallet.version;
    return;
  end if;

  if wallet.balance - wallet.reserved < 2 then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.credit_wallets w set
    balance = w.balance - 2,
    lifetime_spent = w.lifetime_spent + 2,
    version = w.version + 1,
    updated_at = now()
  where w.organization_id = selected_content.organization_id returning * into wallet;

  insert into public.credit_transactions (
    organization_id, type, balance_delta, balance_after, reserved_after,
    idempotency_key, reference_type, reference_id, actor_user_id
  ) values (
    selected_content.organization_id, 'consume', -2, wallet.balance, wallet.reserved,
    'schedule-credit:' || idem_key, 'manual_schedule', selected_content.id, (select auth.uid())
  );

  insert into public.publishing_jobs (
    organization_id, content_id, social_account_id, scheduled_at, timezone, idempotency_key
  ) values (
    selected_content.organization_id, selected_content.id, target_social_account,
    target_scheduled_at, target_timezone, idem_key
  ) returning * into created_job;

  update public.contents set status = 'scheduled', scheduled_at = target_scheduled_at
  where id = selected_content.id;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (selected_content.organization_id, (select auth.uid()), 'schedule_content', 'publishing_job', created_job.id::text,
    jsonb_build_object('scheduled_at', target_scheduled_at, 'timezone', target_timezone, 'charged_credits', 2));

  return query select created_job.id, wallet.organization_id, wallet.balance, wallet.reserved,
    wallet.balance - wallet.reserved, wallet.version;
end;
$$;

revoke all on function app_private.schedule_content(uuid, timestamptz, text, uuid, text) from public, anon;
grant execute on function app_private.schedule_content(uuid, timestamptz, text, uuid, text) to authenticated;
