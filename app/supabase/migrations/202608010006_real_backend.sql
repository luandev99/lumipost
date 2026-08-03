-- Real AI generation state and OAuth-friendly account bootstrap.

create table if not exists public.content_generation_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_key text not null check (char_length(request_key) between 16 and 200),
  format public.content_format not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  credit_cost integer not null check (credit_cost between 0 and 500),
  input jsonb not null default '{}',
  content_id uuid references public.contents(id) on delete set null,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, request_key)
);

create index if not exists content_generation_requests_org_created_idx
  on public.content_generation_requests(organization_id, created_at desc);

alter table public.content_generation_requests enable row level security;
alter table public.content_generation_requests force row level security;

drop policy if exists generation_requests_select_member on public.content_generation_requests;
create policy generation_requests_select_member on public.content_generation_requests
for select to authenticated using (app_private.is_org_member(organization_id));

revoke all on public.content_generation_requests from public, anon, authenticated;
grant select on public.content_generation_requests to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.content_generation_requests;
exception when duplicate_object then null;
end $$;

-- Google can provide either `name` or `full_name`. No provider token is copied to public tables.
create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_org_id uuid := extensions.gen_random_uuid();
  safe_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Minha marca'
  );
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(safe_name, 120));

  insert into public.organizations (id, name, slug, owner_user_id)
  values (
    new_org_id,
    left(safe_name, 120),
    'org-' || replace(new_org_id::text, '-', ''),
    new.id
  );

  insert into public.organization_members (
    organization_id, user_id, role, status, joined_at
  ) values (new_org_id, new.id, 'owner', 'active', now());

  insert into public.credit_wallets (organization_id) values (new_org_id);
  return new;
end;
$$;
