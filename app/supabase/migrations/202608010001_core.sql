-- Lumipost core schema. All tenant data is isolated by organization_id.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create type public.system_role as enum ('user', 'system_admin');
create type public.user_status as enum ('active', 'suspended', 'deleted');
create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.member_status as enum ('active', 'invited', 'suspended');
create type public.content_format as enum ('post', 'carousel', 'story', 'reel', 'video', 'caption');
create type public.content_status as enum (
  'draft', 'generating', 'awaiting_approval', 'scheduled', 'processing',
  'publishing', 'published', 'failed', 'paused', 'canceled'
);
create type public.credit_transaction_type as enum (
  'grant', 'purchase', 'reserve', 'consume', 'release', 'refund', 'expire', 'adjustment'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  avatar_path text,
  system_role public.system_role not null default 'user',
  status public.user_status not null default 'active',
  locale text not null default 'pt-BR',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  owner_user_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_status_idx
  on public.organization_members(user_id, status, organization_id);

create table public.brands (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  industry text not null default '',
  specialty text not null default '',
  audience text not null default '',
  goals text[] not null default '{}',
  content_formats public.content_format[] not null default '{}',
  personality text[] not null default '{}',
  tone text[] not null default '{}',
  primary_color text not null default '#7C3AED' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#A78BFA' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  heading_font text not null default 'Inter',
  body_font text not null default 'Inter',
  visual_style text not null default '',
  logo_path text,
  instagram_handle text not null default '',
  instagram_connected boolean not null default false,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_one_default_per_org_idx on public.brands(organization_id) where is_default;
create index brands_org_idx on public.brands(organization_id);

create table public.plans (
  id text primary key check (id in ('week', 'month', 'year')),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  credits integer not null check (credits >= 0),
  duration_days integer not null check (duration_days > 0),
  available boolean not null default true,
  featured boolean not null default false,
  badge text,
  installments_count integer,
  installments_value_cents integer,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('pending', 'active', 'past_due', 'canceled', 'expired')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  plan_snapshot jsonb not null default '{}',
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create unique index subscriptions_one_active_per_org_idx
  on public.subscriptions(organization_id) where status = 'active';
create index subscriptions_user_idx on public.subscriptions(user_id, status);

create table public.credit_wallets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= balance),
  lifetime_granted bigint not null default 0 check (lifetime_granted >= 0),
  lifetime_spent bigint not null default 0 check (lifetime_spent >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type public.credit_transaction_type not null,
  balance_delta integer not null default 0,
  reserved_delta integer not null default 0,
  balance_after integer not null check (balance_after >= 0),
  reserved_after integer not null check (reserved_after >= 0 and reserved_after <= balance_after),
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 200),
  reservation_key text,
  reference_type text not null,
  reference_id uuid,
  metadata jsonb not null default '{}',
  actor_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index credit_transactions_org_created_idx
  on public.credit_transactions(organization_id, created_at desc);

create table public.contents (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  user_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 240),
  format public.content_format not null,
  source text not null check (source in ('ai', 'manual', 'upload', 'library', 'reused')),
  status public.content_status not null default 'draft',
  topic text not null default '',
  caption text not null default '',
  hashtags text[] not null default '{}',
  cta text not null default '',
  alt_text text,
  location text,
  link text,
  first_comment text,
  collaborators text[] not null default '{}',
  tagged_people text[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  media_paths text[] not null default '{}',
  slide_texts text[],
  reel_script jsonb,
  template_path text,
  social_account_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  folder text,
  usage_count integer not null default 0 check (usage_count >= 0),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index contents_org_status_created_idx
  on public.contents(organization_id, status, created_at desc) where deleted_at is null;
create index contents_user_idx on public.contents(user_id, created_at desc) where deleted_at is null;

create table public.content_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  prompt_version_id uuid,
  template_version_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (content_id, version)
);
create index content_versions_org_content_idx on public.content_versions(organization_id, content_id, version desc);

create table public.weekly_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  user_id uuid not null references public.profiles(id),
  week_start date not null,
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'draft' check (status in ('draft', 'review', 'confirmed', 'canceled')),
  objective text not null default '',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weekly_plans_org_week_idx on public.weekly_plans(organization_id, week_start desc);

create table public.weekly_slots (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  day date not null,
  local_time time not null,
  scheduled_at timestamptz,
  format public.content_format not null,
  source text not null check (source in ('ai', 'manual', 'upload', 'library', 'reused')),
  topic text not null,
  quantity smallint not null default 1 check (quantity between 1 and 5),
  slides smallint not null default 1 check (slides between 1 and 10),
  content_id uuid references public.contents(id),
  library_content_id uuid references public.contents(id),
  estimated_credits integer not null default 0 check (estimated_credits >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index weekly_slots_plan_day_idx on public.weekly_slots(weekly_plan_id, day, local_time);

create table public.social_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  network text not null check (network in ('instagram', 'facebook', 'tiktok', 'linkedin')),
  external_account_id text not null,
  handle text not null,
  display_name text not null,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  token_secret_ref text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network, external_account_id)
);
create index social_accounts_org_idx on public.social_accounts(organization_id, status);

create table public.publishing_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.contents(id),
  content_version_id uuid references public.content_versions(id),
  social_account_id uuid references public.social_accounts(id),
  scheduled_at timestamptz not null,
  timezone text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'queued', 'publishing', 'retry_scheduled', 'published', 'failed', 'paused', 'canceled')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz,
  idempotency_key text not null,
  external_post_id text,
  last_error_code text,
  last_error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index publishing_jobs_due_idx on public.publishing_jobs(status, scheduled_at)
  where status in ('scheduled', 'retry_scheduled');

create table public.visual_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  format text not null check (format in ('post', 'story', 'carousel')),
  package_id text not null,
  aspect_ratio text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  active_version integer not null default 1,
  spec_path text not null,
  spec_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prompt_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  task text not null check (task in ('weekly-plan', 'visual-copy', 'caption', 'hashtags', 'reel-script')),
  format text not null,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  system_prompt text not null,
  user_prompt text not null,
  variables text[] not null default '{}',
  packages text[] not null default '{}',
  output_schema jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create unique index prompt_one_active_idx on public.prompt_templates(task, format) where status = 'active';

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

-- Updated-at helper.
create or replace function app_private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function app_private.set_updated_at();
create trigger organizations_updated_at before update on public.organizations
for each row execute function app_private.set_updated_at();
create trigger brands_updated_at before update on public.brands
for each row execute function app_private.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function app_private.set_updated_at();
create trigger contents_updated_at before update on public.contents
for each row execute function app_private.set_updated_at();
create trigger weekly_plans_updated_at before update on public.weekly_plans
for each row execute function app_private.set_updated_at();
create trigger social_accounts_updated_at before update on public.social_accounts
for each row execute function app_private.set_updated_at();
create trigger publishing_jobs_updated_at before update on public.publishing_jobs
for each row execute function app_private.set_updated_at();

-- Authorization helpers live outside exposed schemas.
create or replace function app_private.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.profiles p on p.id = m.user_id
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and p.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function app_private.has_org_role(target_org uuid, allowed_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.profiles p on p.id = m.user_id
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(allowed_roles)
      and p.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function app_private.is_system_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.system_role = 'system_admin'
      and p.status = 'active'
  );
$$;

-- A new account receives its own isolated organization and wallet.
create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_org_id uuid := extensions.gen_random_uuid();
  safe_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Minha marca');
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(safe_name, 120));

  insert into public.organizations (id, name, slug, owner_user_id)
  values (new_org_id, left(safe_name, 120), 'org-' || replace(new_org_id::text, '-', ''), new.id);

  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (new_org_id, new.id, 'owner', 'active', now());

  insert into public.credit_wallets (organization_id) values (new_org_id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function app_private.handle_new_user();

-- Immutable financial and audit records.
create or replace function app_private.prevent_immutable_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_RECORD';
end;
$$;
create trigger credit_transactions_immutable before update or delete on public.credit_transactions
for each row execute function app_private.prevent_immutable_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs
for each row execute function app_private.prevent_immutable_mutation();

-- Public RPCs expose only caller-owned information.
create or replace function public.get_my_credit_balance()
returns table (organization_id uuid, balance integer, reserved integer, available integer, version bigint)
language sql stable security definer set search_path = '' as $$
  select w.organization_id, w.balance, w.reserved, w.balance - w.reserved, w.version
  from public.credit_wallets w
  where app_private.is_org_member(w.organization_id)
  order by w.updated_at desc
  limit 1;
$$;

create or replace function public.get_my_workspace()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'organization', to_jsonb(o),
    'membership', to_jsonb(m),
    'brand', to_jsonb(b)
  )
  from public.profiles p
  join public.organization_members m on m.user_id = p.id and m.status = 'active'
  join public.organizations o on o.id = m.organization_id and o.status = 'active'
  left join public.brands b on b.organization_id = o.id and b.is_default
  where p.id = (select auth.uid()) and p.status = 'active'
  order by m.created_at
  limit 1;
$$;

create or replace function public.complete_my_onboarding(brand_input jsonb)
returns public.brands language plpgsql security definer set search_path = '' as $$
declare
  target_org uuid;
  saved public.brands;
begin
  select m.organization_id into target_org
  from public.organization_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
  order by m.created_at limit 1;

  if target_org is null or not app_private.has_org_role(target_org, array['owner','admin']::public.member_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.brands (
    organization_id, name, description, industry, specialty, audience, goals,
    content_formats, personality, tone, primary_color, secondary_color,
    heading_font, body_font, visual_style, logo_path, instagram_handle,
    instagram_connected, is_default
  ) values (
    target_org,
    left(coalesce(nullif(trim(brand_input->>'brandName'), ''), 'Minha marca'), 120),
    coalesce(brand_input->>'description', ''), coalesce(brand_input->>'industry', ''),
    coalesce(brand_input->>'specialty', ''), coalesce(brand_input->>'audience', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(brand_input->'goals', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(brand_input->'contentTypes', '[]'::jsonb)))::public.content_format[], '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(brand_input->'personality', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(brand_input->'tone', '[]'::jsonb))), '{}'),
    coalesce(nullif(brand_input->>'primaryColor', ''), '#7C3AED'),
    coalesce(nullif(brand_input->>'secondaryColor', ''), '#A78BFA'),
    left(coalesce(nullif(brand_input->>'headingFont', ''), 'Inter'), 120),
    left(coalesce(nullif(brand_input->>'bodyFont', ''), 'Inter'), 120),
    coalesce(brand_input->>'visualStyle', ''), nullif(brand_input->>'logoUrl', ''),
    coalesce(brand_input->>'instagram', ''), coalesce((brand_input->>'instagramConnected')::boolean, false), true
  )
  on conflict (organization_id) where is_default do update set
    name = excluded.name, description = excluded.description, industry = excluded.industry,
    specialty = excluded.specialty, audience = excluded.audience, goals = excluded.goals,
    content_formats = excluded.content_formats, personality = excluded.personality,
    tone = excluded.tone, primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color, heading_font = excluded.heading_font,
    body_font = excluded.body_font, visual_style = excluded.visual_style,
    logo_path = excluded.logo_path, instagram_handle = excluded.instagram_handle,
    instagram_connected = excluded.instagram_connected
  returning * into saved;

  update public.profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = (select auth.uid());
  return saved;
end;
$$;

-- Server-only credit debit. Edge Functions validate the user's JWT, compute price, then call with a secret client.
create or replace function public.consume_credits_service(
  target_org uuid,
  amount_to_consume integer,
  idem_key text,
  ref_type text,
  ref_id uuid default null,
  actor_id uuid default null
)
returns public.credit_wallets language plpgsql security definer set search_path = '' as $$
declare
  wallet public.credit_wallets;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if amount_to_consume <= 0 or amount_to_consume > 10000 then raise exception 'INVALID_AMOUNT'; end if;

  select * into wallet from public.credit_wallets where organization_id = target_org for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  if exists (select 1 from public.credit_transactions where organization_id = target_org and idempotency_key = idem_key) then
    return wallet;
  end if;
  if wallet.balance - wallet.reserved < amount_to_consume then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.credit_wallets set
    balance = balance - amount_to_consume,
    lifetime_spent = lifetime_spent + amount_to_consume,
    version = version + 1,
    updated_at = now()
  where organization_id = target_org returning * into wallet;

  insert into public.credit_transactions (
    organization_id, type, balance_delta, balance_after, reserved_after,
    idempotency_key, reference_type, reference_id, actor_user_id
  ) values (
    target_org, 'consume', -amount_to_consume, wallet.balance, wallet.reserved,
    idem_key, ref_type, ref_id, actor_id
  );
  return wallet;
end;
$$;

create or replace function public.grant_credits_service(
  target_org uuid,
  amount_to_grant integer,
  idem_key text,
  ref_type text,
  ref_id uuid default null,
  actor_id uuid default null
)
returns public.credit_wallets language plpgsql security definer set search_path = '' as $$
declare
  wallet public.credit_wallets;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  if amount_to_grant <= 0 or amount_to_grant > 1000000 then raise exception 'INVALID_AMOUNT'; end if;
  select * into wallet from public.credit_wallets where organization_id = target_org for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if exists (select 1 from public.credit_transactions where organization_id = target_org and idempotency_key = idem_key) then return wallet; end if;

  update public.credit_wallets set
    balance = balance + amount_to_grant,
    lifetime_granted = lifetime_granted + amount_to_grant,
    version = version + 1,
    updated_at = now()
  where organization_id = target_org returning * into wallet;

  insert into public.credit_transactions (
    organization_id, type, balance_delta, balance_after, reserved_after,
    idempotency_key, reference_type, reference_id, actor_user_id
  ) values (
    target_org, 'grant', amount_to_grant, wallet.balance, wallet.reserved,
    idem_key, ref_type, ref_id, actor_id
  );
  return wallet;
end;
$$;

-- Manual scheduling charges exactly two credits and creates the job in one transaction.
create or replace function public.schedule_content(
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
  if target_scheduled_at <= now() then raise exception 'SCHEDULE_MUST_BE_FUTURE'; end if;
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

-- Function privileges are deny-by-default.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app_private from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app_private revoke execute on functions from public, anon, authenticated;

grant usage on schema app_private to authenticated;
grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.has_org_role(uuid, public.member_role[]) to authenticated;
grant execute on function app_private.is_system_admin() to authenticated;
grant execute on function public.get_my_credit_balance() to authenticated;
grant execute on function public.get_my_workspace() to authenticated;
grant execute on function public.complete_my_onboarding(jsonb) to authenticated;
grant execute on function public.schedule_content(uuid, timestamptz, text, uuid, text) to authenticated;
grant execute on function public.consume_credits_service(uuid, integer, text, text, uuid, uuid) to service_role;
grant execute on function public.grant_credits_service(uuid, integer, text, text, uuid, uuid) to service_role;

