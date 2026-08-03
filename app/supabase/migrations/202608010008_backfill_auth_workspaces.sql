-- Accounts created before the workspace trigger was installed must receive the
-- same isolated profile, organization and wallet as every new signup.
do $$
declare
  auth_user record;
  new_org_id uuid;
  safe_name text;
begin
  for auth_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at
  loop
    new_org_id := extensions.gen_random_uuid();
    safe_name := coalesce(
      nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
      'Minha marca'
    );

    insert into public.profiles (id, display_name)
    values (auth_user.id, left(safe_name, 120));

    insert into public.organizations (id, name, slug, owner_user_id)
    values (
      new_org_id,
      left(safe_name, 120),
      'org-' || replace(new_org_id::text, '-', ''),
      auth_user.id
    );

    insert into public.organization_members (
      organization_id, user_id, role, status, joined_at
    ) values (new_org_id, auth_user.id, 'owner', 'active', now());

    insert into public.credit_wallets (organization_id)
    values (new_org_id);
  end loop;
end;
$$;
