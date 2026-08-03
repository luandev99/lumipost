# 09 — Blueprint SQL inicial

Este arquivo é um ponto de partida para migrations, não uma migration final pronta para produção. Separe-o em arquivos pequenos, complete grants/policies, teste no Supabase local e gere tipos TypeScript após estabilizar o schema.

## Extensões e tipos

```sql
create extension if not exists pgcrypto;
create extension if not exists pgmq;
create extension if not exists pg_cron;

create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.member_status as enum ('invited', 'active', 'suspended');
create type public.content_format as enum ('post', 'carousel', 'story', 'reel', 'video', 'caption');
create type public.content_status as enum (
  'draft', 'generating', 'awaiting_approval', 'scheduled',
  'processing', 'publishing', 'published', 'failed', 'paused', 'canceled'
);
create type public.job_status as enum (
  'pending', 'queued', 'processing', 'waiting_provider',
  'retry_scheduled', 'succeeded', 'failed', 'canceled'
);
create type public.credit_transaction_type as enum (
  'grant', 'purchase', 'reserve', 'consume', 'release',
  'refund', 'expire', 'adjustment'
);
```

Em produção, avalie se `pgmq`/`pg_cron` serão habilitados pelo dashboard/módulos do projeto em vez da mesma migration.

## Identidade e organização

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  locale text not null default 'pt-BR',
  system_role text not null default 'user' check (system_role in ('user', 'system_admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  timezone text not null default 'America/Sao_Paulo',
  owner_user_id uuid not null references public.profiles(id),
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

create index organization_members_user_idx
  on public.organization_members(user_id, status);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  industry text not null default '',
  specialty text not null default '',
  audience text not null default '',
  goals text[] not null default '{}',
  content_formats public.content_format[] not null default '{}',
  personality text[] not null default '{}',
  tone text[] not null default '{}',
  primary_color text not null default '#7C3AED',
  secondary_color text not null default '#A78BFA',
  heading_font text not null default 'Inter',
  body_font text not null default 'Inter',
  visual_style text not null default '',
  logo_asset_id uuid,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brands_one_default_per_org_idx
  on public.brands(organization_id)
  where is_default;
```

Adicione a FK de `logo_asset_id` depois de criar a tabela de assets, para evitar dependência circular na migration inicial.

## Conteúdo

```sql
create table public.contents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  format public.content_format not null,
  source text not null check (source in ('ai', 'manual', 'upload', 'library', 'reused')),
  status public.content_status not null default 'draft',
  topic text not null default '',
  current_version_id uuid,
  approved_version_id uuid,
  folder text,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index contents_org_status_created_idx
  on public.contents(organization_id, status, created_at desc)
  where deleted_at is null;

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  version integer not null check (version > 0),
  caption text not null default '',
  hashtags text[] not null default '{}',
  cta text not null default '',
  alt_text text,
  location text,
  link text,
  first_comment text,
  collaborators text[] not null default '{}',
  tagged_people text[] not null default '{}',
  copy_payload jsonb not null default '{}',
  prompt_version_id uuid,
  template_version_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (content_id, version)
);

alter table public.contents
  add constraint contents_current_version_fk
  foreign key (current_version_id) references public.content_versions(id);

alter table public.contents
  add constraint contents_approved_version_fk
  foreign key (approved_version_id) references public.content_versions(id);

create table public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text,
  width integer,
  height integer,
  duration_ms integer,
  source text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions(id) on delete cascade,
  storage_object_id uuid not null references public.storage_objects(id),
  role text not null check (role in ('primary', 'slide', 'cover', 'video', 'thumbnail', 'audio')),
  position integer not null default 0 check (position >= 0),
  duration_ms integer,
  width integer,
  height integer,
  metadata jsonb not null default '{}',
  unique (content_version_id, role, position)
);
```

## Planejamento e publicação

```sql
create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  week_start date not null,
  timezone text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'confirmed', 'canceled')),
  objective text not null default '',
  requested_by uuid not null references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weekly_plans_org_week_idx
  on public.weekly_plans(organization_id, week_start desc);

create table public.weekly_slots (
  id uuid primary key default gen_random_uuid(),
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
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create index weekly_slots_plan_schedule_idx
  on public.weekly_slots(weekly_plan_id, scheduled_at);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  network text not null check (network in ('instagram', 'facebook', 'tiktok', 'linkedin')),
  external_account_id text not null,
  handle text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  token_secret_ref text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network, external_account_id)
);

create table public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.contents(id),
  content_version_id uuid not null references public.content_versions(id),
  social_account_id uuid not null references public.social_accounts(id),
  scheduled_at timestamptz not null,
  timezone text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'queued', 'publishing', 'retry_scheduled', 'published', 'failed', 'paused', 'canceled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  idempotency_key text not null,
  external_post_id text,
  provider_response jsonb,
  last_error_code text,
  last_error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index publishing_jobs_due_idx
  on public.publishing_jobs(status, coalesce(next_attempt_at, scheduled_at))
  where status in ('scheduled', 'retry_scheduled');
```

## Ledger de créditos

```sql
create table public.credit_wallets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= balance),
  lifetime_granted bigint not null default 0,
  lifetime_spent bigint not null default 0,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type public.credit_transaction_type not null,
  balance_delta integer not null default 0,
  reserved_delta integer not null default 0,
  balance_after integer not null check (balance_after >= 0),
  reserved_after integer not null check (reserved_after >= 0),
  reservation_key text,
  reference_type text not null,
  reference_id uuid,
  idempotency_key text not null,
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index credit_transactions_org_created_idx
  on public.credit_transactions(organization_id, created_at desc);
```

### Reserva atômica

O exemplo usa saldo total e `reserved`; o disponível é `balance - reserved`. Ajuste grants/consumos ao seu modelo contábil e teste concorrência.

```sql
create or replace function public.reserve_credits(
  target_org uuid,
  amount_to_reserve integer,
  reservation text,
  idem_key text,
  ref_type text,
  ref_id uuid default null
)
returns public.credit_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet public.credit_wallets;
  existing public.credit_transactions;
begin
  if amount_to_reserve <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if not public.has_org_role(target_org, array['owner', 'admin', 'editor']) then
    raise exception 'FORBIDDEN';
  end if;

  select * into existing
  from public.credit_transactions
  where organization_id = target_org
    and idempotency_key = idem_key;

  if found then
    select * into wallet
    from public.credit_wallets
    where organization_id = target_org;
    return wallet;
  end if;

  select * into wallet
  from public.credit_wallets
  where organization_id = target_org
  for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if wallet.balance - wallet.reserved < amount_to_reserve then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.credit_wallets
  set reserved = reserved + amount_to_reserve,
      version = version + 1,
      updated_at = now()
  where organization_id = target_org
  returning * into wallet;

  insert into public.credit_transactions (
    organization_id, type, balance_delta, reserved_delta, balance_after, reserved_after,
    reservation_key, reference_type, reference_id, idempotency_key,
    created_by
  ) values (
    target_org, 'reserve', 0, amount_to_reserve, wallet.balance, wallet.reserved,
    reservation, ref_type, ref_id, idem_key, (select auth.uid())
  );

  return wallet;
end;
$$;
```

Em produção, não exponha esta função livremente. Você pode separar uma função interna sem `auth.uid()` para workers e uma RPC pública estreita, ou chamar pelo servidor após validar o usuário. Crie as funções auxiliares de RLS mostradas adiante antes desta rotina. A função de finalização deve travar a mesma wallet, localizar uma única reserva aberta, decrementar `balance` e `reserved` e inserir `consume` com ambos os deltas negativos; cancelamento insere `release`, com `balance_delta = 0` e `reserved_delta` negativo.

## Jobs de IA e outbox

```sql
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id),
  content_id uuid references public.contents(id),
  job_type text not null,
  provider text not null,
  model text not null,
  status public.job_status not null default 'pending',
  progress smallint not null default 0 check (progress between 0 and 100),
  estimated_credits integer not null default 0,
  reserved_credits integer not null default 0,
  consumed_credits integer not null default 0,
  provider_job_id text,
  idempotency_key text not null,
  input_payload jsonb not null,
  output_payload jsonb,
  error_code text,
  error_message text,
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index ai_jobs_worker_idx
  on public.ai_jobs(status, created_at)
  where status in ('pending', 'queued', 'retry_scheduled', 'processing', 'waiting_provider');

create index ai_jobs_provider_idx
  on public.ai_jobs(provider, provider_job_id)
  where provider_job_id is not null;

create table public.ai_job_events (
  id bigint generated always as identity primary key,
  ai_job_id uuid not null references public.ai_jobs(id) on delete cascade,
  sequence integer not null,
  stage text not null,
  message text not null,
  progress smallint not null check (progress between 0 and 100),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (ai_job_id, sequence)
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index outbox_dispatch_idx
  on public.outbox_events(next_attempt_at, created_at)
  where published_at is null;
```

## RLS base

```sql
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role::text = any(allowed)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

alter table public.brands enable row level security;
alter table public.contents enable row level security;
alter table public.content_versions enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.weekly_slots enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.ai_job_events enable row level security;
alter table public.publishing_jobs enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;

create policy brands_read
on public.brands for select to authenticated
using (public.is_org_member(organization_id));

create policy brands_write
on public.brands for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

create policy contents_read
on public.contents for select to authenticated
using (public.is_org_member(organization_id));

create policy contents_insert
on public.contents for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'editor'])
  and created_by = (select auth.uid())
);

create policy contents_update
on public.contents for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'editor']));

create policy wallet_read
on public.credit_wallets for select to authenticated
using (public.is_org_member(organization_id));

create policy ledger_read
on public.credit_transactions for select to authenticated
using (public.is_org_member(organization_id));
```

`content_versions` e tabelas filhas não possuem `organization_id`; suas policies precisam usar `exists` através de `contents` ou você pode duplicar `organization_id` com consistência garantida. Para grande volume, duplicar a chave de tenant costuma simplificar RLS e índices.

Não crie policies client-side de escrita em wallet/ledger/jobs de tentativa. Conceda somente o que for necessário ao papel `authenticated`; service/secret keys bypassam RLS e precisam ficar no servidor.

## Validação de cinco conteúdos por dia

Faça a validação dentro de `confirm_weekly_plan`, sob lock do plano:

```sql
if exists (
  select 1
  from public.weekly_slots s
  where s.weekly_plan_id = target_plan
  group by s.day
  having sum(s.quantity) > 5
) then
  raise exception 'MAX_FIVE_CONTENTS_PER_DAY';
end if;
```

Também valide `day between week_start and week_start + 6`, horário futuro e conflito por conta social. A check constraint isolada não consegue somar linhas do mesmo dia.

## Filas e Cron

Crie filas duráveis:

```sql
select pgmq.create('ai_text');
select pgmq.create('ai_image');
select pgmq.create('ai_video');
select pgmq.create('media_render');
select pgmq.create('social_publish');
select pgmq.create('webhook_process');
```

Exemplo conceitual de Cron que chama uma função curta:

```sql
select cron.schedule(
  'dispatch-due-publications',
  '* * * * *',
  $$ select public.dispatch_due_publications(50); $$
);
```

Não exponha `pgmq` diretamente ao cliente. O dispatcher e workers acessam filas com credencial de serviço ou funções restritas.

## Verificações antes de aplicar

- Separar o SQL em migrations ordenadas.
- Adicionar `updated_at` triggers sem bloquear fluxos críticos.
- Definir grants de tabela/função explicitamente.
- Completar todas as policies filhas e de Storage.
- Adicionar templates, prompts, billing, audit e webhook tables descritas no modelo de dados.
- Testar rollback e banco vazio.
- Executar concorrência real no ledger e no dispatcher.
- Gerar tipos com Supabase CLI e integrar aos repositories.
