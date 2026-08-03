-- Billing, Meta OAuth and profile-analysis persistence.
-- Provider credentials stay in Edge Function Secrets. Per-user Meta tokens are encrypted by Vault.
create extension if not exists supabase_vault with schema vault;

create type public.checkout_kind as enum ('subscription', 'credit_pack');
create type public.checkout_status as enum ('created', 'open', 'paid', 'expired', 'failed');
create type public.analysis_status as enum ('queued', 'processing', 'review', 'applied', 'failed', 'canceled');

create table public.credit_products (
  id text primary key check (id ~ '^credits_[0-9]+$'),
  name text not null check (char_length(name) between 1 and 80),
  credits integer not null check (credits between 1 and 100000),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  stripe_price_secret_name text not null unique check (stripe_price_secret_name ~ '^STRIPE_PRICE_[A-Z0-9_]+$'),
  available boolean not null default true,
  featured boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans
  add column stripe_price_secret_name text unique,
  add constraint plans_stripe_price_secret_name_check
    check (stripe_price_secret_name is null or stripe_price_secret_name ~ '^STRIPE_PRICE_[A-Z0-9_]+$');

create table public.billing_customers (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_provider_subscription_unique_idx
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create table public.billing_checkout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.checkout_kind not null,
  plan_id text references public.plans(id),
  credit_product_id text references public.credit_products(id),
  stripe_session_id text not null unique check (stripe_session_id ~ '^cs_'),
  stripe_customer_id text not null check (stripe_customer_id ~ '^cus_'),
  status public.checkout_status not null default 'created',
  amount_total integer check (amount_total is null or amount_total >= 0),
  currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'subscription' and plan_id is not null and credit_product_id is null)
    or (kind = 'credit_pack' and plan_id is null and credit_product_id is not null)
  )
);
create index billing_checkout_sessions_org_created_idx
  on public.billing_checkout_sessions(organization_id, created_at desc);

create table public.billing_events (
  provider_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  error_code text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.meta_oauth_states (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  state_sha256 text not null unique check (state_sha256 ~ '^[0-9a-f]{64}$'),
  return_path text not null default '/social-accounts' check (return_path like '/%'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index meta_oauth_states_expiry_idx on public.meta_oauth_states(expires_at)
  where consumed_at is null;

alter table public.social_accounts
  add column provider text not null default 'meta',
  add column account_type text,
  add column biography text,
  add column website text,
  add column followers_count bigint check (followers_count is null or followers_count >= 0),
  add column media_count bigint check (media_count is null or media_count >= 0),
  add column last_synced_at timestamptz,
  add column token_rotated_at timestamptz;

create table public.social_profile_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  profile jsonb not null default '{}',
  recent_media jsonb not null default '[]',
  captured_at timestamptz not null default now()
);
create index social_profile_snapshots_account_idx
  on public.social_profile_snapshots(social_account_id, captured_at desc);

create table public.brand_analysis_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  status public.analysis_status not null default 'queued',
  input_snapshot_id uuid references public.social_profile_snapshots(id) on delete set null,
  result jsonb,
  model text,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_analysis_jobs_org_created_idx
  on public.brand_analysis_jobs(organization_id, created_at desc);

alter table public.publishing_jobs
  add column provider text not null default 'meta',
  add column external_container_id text,
  add column provider_status text,
  add column provider_response jsonb not null default '{}',
  add column locked_at timestamptz,
  add column lock_token uuid;
alter table public.publishing_jobs alter column max_attempts set default 12;

create trigger credit_products_updated_at before update on public.credit_products
for each row execute function app_private.set_updated_at();
create trigger billing_customers_updated_at before update on public.billing_customers
for each row execute function app_private.set_updated_at();
create trigger billing_checkout_sessions_updated_at before update on public.billing_checkout_sessions
for each row execute function app_private.set_updated_at();
create trigger brand_analysis_jobs_updated_at before update on public.brand_analysis_jobs
for each row execute function app_private.set_updated_at();

-- Only a service-role request can put or retrieve a provider token. Browser roles cannot access Vault.
create or replace function public.store_social_token_service(
  target_account uuid,
  access_token text,
  expires_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_ref uuid;
  secret_ref uuid;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if access_token is null or char_length(access_token) < 20 or char_length(access_token) > 8192 then
    raise exception 'INVALID_TOKEN';
  end if;

  select nullif(token_secret_ref, '')::uuid into current_ref
  from public.social_accounts where id = target_account for update;
  if not found then raise exception 'SOCIAL_ACCOUNT_NOT_FOUND'; end if;

  if current_ref is null then
    secret_ref := vault.create_secret(
      access_token,
      'meta-account-' || target_account::text,
      'Meta user token for Lumipost social account'
    );
  else
    perform vault.update_secret(current_ref, access_token);
    secret_ref := current_ref;
  end if;

  update public.social_accounts set
    token_secret_ref = secret_ref::text,
    token_expires_at = expires_at,
    token_rotated_at = now(),
    status = 'active'
  where id = target_account;
  return secret_ref;
end;
$$;

create or replace function public.read_social_token_service(target_account uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  secret_ref uuid;
  token_value text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select nullif(token_secret_ref, '')::uuid into secret_ref
  from public.social_accounts where id = target_account and status = 'active';
  if not found or secret_ref is null then raise exception 'SOCIAL_TOKEN_NOT_FOUND'; end if;
  select decrypted_secret into token_value from vault.decrypted_secrets where id = secret_ref;
  if token_value is null then raise exception 'SOCIAL_TOKEN_NOT_FOUND'; end if;
  return token_value;
end;
$$;

create or replace function public.delete_social_token_service(target_account uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  secret_ref uuid;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select nullif(token_secret_ref, '')::uuid into secret_ref
  from public.social_accounts where id = target_account for update;
  if secret_ref is not null then delete from vault.secrets where id = secret_ref; end if;
  update public.social_accounts set token_secret_ref = null, token_expires_at = null, status = 'revoked'
  where id = target_account;
end;
$$;

create or replace function public.claim_due_publishing_jobs_service(batch_size integer default 10)
returns setof public.publishing_jobs language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if batch_size < 1 or batch_size > 25 then raise exception 'INVALID_BATCH_SIZE'; end if;
  return query
  with due as (
    select j.id
    from public.publishing_jobs j
    where j.status in ('scheduled', 'queued', 'retry_scheduled')
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

revoke all on table vault.secrets, vault.decrypted_secrets from public, anon, authenticated;
revoke execute on function public.store_social_token_service(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.read_social_token_service(uuid) from public, anon, authenticated;
revoke execute on function public.delete_social_token_service(uuid) from public, anon, authenticated;
grant execute on function public.store_social_token_service(uuid, text, timestamptz) to service_role;
grant execute on function public.read_social_token_service(uuid) to service_role;
grant execute on function public.delete_social_token_service(uuid) to service_role;
revoke execute on function public.claim_due_publishing_jobs_service(integer) from public, anon, authenticated;
grant execute on function public.claim_due_publishing_jobs_service(integer) to service_role;

alter table public.credit_products enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_events enable row level security;
alter table public.meta_oauth_states enable row level security;
alter table public.social_profile_snapshots enable row level security;
alter table public.brand_analysis_jobs enable row level security;

alter table public.credit_products force row level security;
alter table public.billing_customers force row level security;
alter table public.billing_checkout_sessions force row level security;
alter table public.billing_events force row level security;
alter table public.meta_oauth_states force row level security;
alter table public.social_profile_snapshots force row level security;
alter table public.brand_analysis_jobs force row level security;

create policy credit_products_select_available on public.credit_products
for select to anon, authenticated using (available or app_private.is_system_admin());
create policy billing_customers_select_member on public.billing_customers
for select to authenticated using (app_private.is_org_member(organization_id));
create policy checkout_sessions_select_member on public.billing_checkout_sessions
for select to authenticated using (app_private.is_org_member(organization_id));
create policy social_snapshots_select_member on public.social_profile_snapshots
for select to authenticated using (app_private.is_org_member(organization_id));
create policy analysis_jobs_select_member on public.brand_analysis_jobs
for select to authenticated using (app_private.is_org_member(organization_id));

grant select on public.credit_products to anon, authenticated;
grant select on public.billing_customers, public.billing_checkout_sessions,
  public.social_profile_snapshots, public.brand_analysis_jobs to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.brand_analysis_jobs;
exception when duplicate_object then null;
end $$;
