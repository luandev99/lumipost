-- Defense-in-depth after the integrations migration.

-- OAuth redirects are deliberately limited to known SPA routes.
alter table public.meta_oauth_states
  drop constraint if exists meta_oauth_states_return_path_check;
alter table public.meta_oauth_states
  add constraint meta_oauth_states_return_path_check
  check (return_path in ('/social-accounts', '/brand'));

-- Tenant ownership cannot be moved by a browser update, even when a user is
-- a member of more than one organization.
create or replace function app_private.prevent_organization_reassignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'ORGANIZATION_IMMUTABLE';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subscriptions', 'credit_transactions', 'contents', 'content_versions',
    'weekly_plans', 'weekly_slots', 'social_accounts', 'publishing_jobs',
    'audit_logs', 'billing_customers', 'billing_checkout_sessions',
    'social_profile_snapshots', 'brand_analysis_jobs'
  ] loop
    execute format(
      'drop trigger if exists prevent_organization_reassignment on public.%I',
      table_name
    );
    execute format(
      'create trigger prevent_organization_reassignment before update on public.%I for each row execute function app_private.prevent_organization_reassignment()',
      table_name
    );
  end loop;
end $$;

-- The second object-path segment belongs to the authenticated uploader.
create or replace function app_private.storage_user(object_name text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  segment text;
begin
  segment := split_part(object_name, '/', 2);
  if segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return segment::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function app_private.storage_user(text) from public, anon;
grant execute on function app_private.storage_user(text) to authenticated;

drop policy if exists storage_insert_org on storage.objects;
create policy storage_insert_org on storage.objects
for insert to authenticated with check (
  (
    bucket_id = 'brand-assets'
    and app_private.has_org_role(
      app_private.storage_organization(name),
      array['owner','admin','editor']::public.member_role[]
    )
  )
  or (
    bucket_id = 'content-uploads'
    and app_private.has_org_role(
      app_private.storage_organization(name),
      array['owner','admin','editor']::public.member_role[]
    )
    and app_private.storage_user(name) = (select auth.uid())
  )
);

drop policy if exists storage_update_org on storage.objects;
create policy storage_update_org on storage.objects
for update to authenticated
using (
  (bucket_id = 'brand-assets' and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin','editor']::public.member_role[]))
  or (bucket_id = 'content-uploads' and app_private.storage_user(name) = (select auth.uid()))
)
with check (
  (bucket_id = 'brand-assets' and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin','editor']::public.member_role[]))
  or (
    bucket_id = 'content-uploads'
    and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin','editor']::public.member_role[])
    and app_private.storage_user(name) = (select auth.uid())
  )
);

drop policy if exists storage_delete_org on storage.objects;
create policy storage_delete_org on storage.objects
for delete to authenticated using (
  (bucket_id = 'brand-assets' and app_private.has_org_role(app_private.storage_organization(name), array['owner','admin']::public.member_role[]))
  or (
    bucket_id = 'content-uploads'
    and app_private.is_org_member(app_private.storage_organization(name))
    and (
      app_private.storage_user(name) = (select auth.uid())
      or app_private.has_org_role(app_private.storage_organization(name), array['owner','admin']::public.member_role[])
    )
  )
);

-- A browser never needs the Vault reference for an Instagram token.
revoke select on public.social_accounts from authenticated;
grant select (
  id, organization_id, brand_id, user_id, network, external_account_id,
  handle, display_name, avatar_url, status, token_expires_at, scopes,
  created_at, updated_at, provider, account_type, biography, website,
  followers_count, media_count, last_synced_at, token_rotated_at
) on public.social_accounts to authenticated;

-- Two active jobs cannot target the same account at the exact same instant.
create unique index if not exists publishing_jobs_unique_schedule_idx
  on public.publishing_jobs (organization_id, social_account_id, scheduled_at)
  where status in ('scheduled', 'queued', 'publishing', 'retry_scheduled', 'paused');
