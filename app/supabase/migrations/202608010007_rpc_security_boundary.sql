-- Keep browser-facing RPCs as SECURITY INVOKER. The two operations that need
-- elevated SQL privileges live outside PostgREST's exposed schema and retain
-- strict auth.uid()/organization checks from the original implementation.

alter function public.get_my_credit_balance() security invoker;
alter function public.get_my_workspace() security invoker;

alter function public.complete_my_onboarding(jsonb) set schema app_private;
alter function public.schedule_content(uuid, timestamptz, text, uuid, text) set schema app_private;

create function public.complete_my_onboarding(brand_input jsonb)
returns public.brands
language sql
security invoker
set search_path = ''
as $$
  select app_private.complete_my_onboarding(brand_input);
$$;

create function public.schedule_content(
  target_content uuid,
  target_scheduled_at timestamptz,
  target_timezone text,
  target_social_account uuid,
  idem_key text
)
returns table (
  job_id uuid,
  organization_id uuid,
  balance integer,
  reserved integer,
  available integer,
  version bigint
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from app_private.schedule_content(
    target_content,
    target_scheduled_at,
    target_timezone,
    target_social_account,
    idem_key
  );
$$;

revoke all on function app_private.complete_my_onboarding(jsonb) from public, anon;
revoke all on function app_private.schedule_content(uuid, timestamptz, text, uuid, text) from public, anon;
grant execute on function app_private.complete_my_onboarding(jsonb) to authenticated;
grant execute on function app_private.schedule_content(uuid, timestamptz, text, uuid, text) to authenticated;

revoke all on function public.get_my_credit_balance() from public, anon;
revoke all on function public.get_my_workspace() from public, anon;
revoke all on function public.complete_my_onboarding(jsonb) from public, anon;
revoke all on function public.schedule_content(uuid, timestamptz, text, uuid, text) from public, anon;
grant execute on function public.get_my_credit_balance() to authenticated;
grant execute on function public.get_my_workspace() to authenticated;
grant execute on function public.complete_my_onboarding(jsonb) to authenticated;
grant execute on function public.schedule_content(uuid, timestamptz, text, uuid, text) to authenticated;
