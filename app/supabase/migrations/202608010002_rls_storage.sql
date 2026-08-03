-- Row Level Security is the primary authorization boundary for browser access.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.brands enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.contents enable row level security;
alter table public.content_versions enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.weekly_slots enable row level security;
alter table public.social_accounts enable row level security;
alter table public.publishing_jobs enable row level security;
alter table public.visual_templates enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.audit_logs enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.brands force row level security;
alter table public.subscriptions force row level security;
alter table public.credit_wallets force row level security;
alter table public.credit_transactions force row level security;
alter table public.contents force row level security;
alter table public.content_versions force row level security;
alter table public.weekly_plans force row level security;
alter table public.weekly_slots force row level security;
alter table public.social_accounts force row level security;
alter table public.publishing_jobs force row level security;
alter table public.audit_logs force row level security;

-- Profiles are deliberately read-only from the browser; profile updates use narrow RPCs.
create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()) or app_private.is_system_admin());

create policy organizations_select_member on public.organizations
for select to authenticated using (app_private.is_org_member(id));

create policy members_select_same_org on public.organization_members
for select to authenticated using (app_private.is_org_member(organization_id));

create policy brands_select_member on public.brands
for select to authenticated using (app_private.is_org_member(organization_id));
create policy brands_insert_editor on public.brands
for insert to authenticated with check (
  app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[])
);
create policy brands_update_editor on public.brands
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]))
with check (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));

create policy plans_select_available on public.plans
for select to anon, authenticated using (available or app_private.is_system_admin());

create policy subscriptions_select_member on public.subscriptions
for select to authenticated using (app_private.is_org_member(organization_id));

create policy wallets_select_member on public.credit_wallets
for select to authenticated using (app_private.is_org_member(organization_id));
create policy ledger_select_member on public.credit_transactions
for select to authenticated using (app_private.is_org_member(organization_id));

create policy contents_select_member on public.contents
for select to authenticated using (app_private.is_org_member(organization_id));
create policy contents_insert_editor on public.contents
for insert to authenticated with check (
  app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[])
  and user_id = (select auth.uid())
);
create policy contents_update_editor on public.contents
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]))
with check (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));
create policy contents_delete_editor on public.contents
for delete to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));

create policy content_versions_select_member on public.content_versions
for select to authenticated using (app_private.is_org_member(organization_id));
create policy content_versions_insert_editor on public.content_versions
for insert to authenticated with check (
  app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[])
  and created_by = (select auth.uid())
);

create policy weekly_plans_select_member on public.weekly_plans
for select to authenticated using (app_private.is_org_member(organization_id));
create policy weekly_plans_insert_editor on public.weekly_plans
for insert to authenticated with check (
  app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[])
  and user_id = (select auth.uid())
);
create policy weekly_plans_update_editor on public.weekly_plans
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]))
with check (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));
create policy weekly_plans_delete_editor on public.weekly_plans
for delete to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));

create policy weekly_slots_select_member on public.weekly_slots
for select to authenticated using (app_private.is_org_member(organization_id));
create policy weekly_slots_insert_editor on public.weekly_slots
for insert to authenticated with check (
  app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[])
);
create policy weekly_slots_update_editor on public.weekly_slots
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]))
with check (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));
create policy weekly_slots_delete_editor on public.weekly_slots
for delete to authenticated
using (app_private.has_org_role(organization_id, array['owner','admin','editor']::public.member_role[]));

create policy social_accounts_select_member on public.social_accounts
for select to authenticated using (app_private.is_org_member(organization_id));
create policy publishing_jobs_select_member on public.publishing_jobs
for select to authenticated using (app_private.is_org_member(organization_id));

create policy templates_select_published on public.visual_templates
for select to authenticated using (status = 'published' or app_private.is_system_admin());
create policy prompts_select_active on public.prompt_templates
for select to authenticated using (status = 'active' or app_private.is_system_admin());

create policy audit_select_admin on public.audit_logs
for select to authenticated using (
  organization_id is not null
  and app_private.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  or app_private.is_system_admin()
);

-- Explicit grants: RLS does not replace SQL privileges.
grant select on public.profiles, public.organizations, public.organization_members,
  public.plans, public.subscriptions, public.credit_wallets, public.credit_transactions,
  public.social_accounts, public.publishing_jobs, public.visual_templates,
  public.prompt_templates, public.audit_logs to authenticated;
grant select, insert, update on public.brands to authenticated;
grant select, insert, update, delete on public.contents, public.weekly_plans, public.weekly_slots to authenticated;
grant select, insert on public.content_versions to authenticated;
grant select on public.plans to anon;

-- Private Storage buckets. The first path segment must be the organization UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand-assets', 'brand-assets', false, 10485760, array['image/png','image/jpeg','image/webp','image/svg+xml','font/woff2']),
  ('content-uploads', 'content-uploads', false, 104857600, array['image/png','image/jpeg','image/webp','video/mp4']),
  ('generated-media', 'generated-media', false, 104857600, array['image/png','image/jpeg','image/webp','video/mp4']),
  ('content-renders', 'content-renders', false, 104857600, array['image/png','image/jpeg','image/webp','application/zip','video/mp4']),
  ('template-specs', 'template-specs', false, 5242880, array['application/json']),
  ('exports', 'exports', false, 104857600, array['image/png','application/zip','video/mp4','application/json'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app_private.storage_organization(object_name text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  segment text;
begin
  segment := split_part(object_name, '/', 1);
  if segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return segment::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function app_private.storage_organization(text) from public, anon;
grant execute on function app_private.storage_organization(text) to authenticated;

create policy storage_select_org on storage.objects
for select to authenticated using (
  bucket_id in ('brand-assets','content-uploads','generated-media','content-renders','template-specs','exports')
  and app_private.is_org_member(app_private.storage_organization(name))
);
create policy storage_insert_org on storage.objects
for insert to authenticated with check (
  bucket_id in ('brand-assets','content-uploads')
  and app_private.has_org_role(
    app_private.storage_organization(name),
    array['owner','admin','editor']::public.member_role[]
  )
);
create policy storage_update_org on storage.objects
for update to authenticated
using (
  bucket_id in ('brand-assets','content-uploads')
  and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin','editor']::public.member_role[])
)
with check (
  bucket_id in ('brand-assets','content-uploads')
  and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin','editor']::public.member_role[])
);
create policy storage_delete_org on storage.objects
for delete to authenticated using (
  bucket_id in ('brand-assets','content-uploads')
  and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin']::public.member_role[])
);

-- Realtime pushes authoritative balance and job changes to Redux.
do $$
begin
  alter publication supabase_realtime add table public.credit_wallets;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.contents;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.publishing_jobs;
exception when duplicate_object then null;
end $$;

