-- Identidade de marca: Logo (símbolo) já existia via logo_path; agora ganha
-- uma Logomarca separada (peça completa com o nome), até 5 imagens de
-- referência de estilo (enviadas como pixels reais na geração de imagem) e
-- um campo de tipo de negócio para orientar tom/estilo da IA. Também troca o
-- default de cor de violeta para um par neutro — só afeta marcas NOVAS,
-- nenhuma linha existente é alterada.

alter table public.brands
  add column logomark_path text,
  add column reference_image_paths text[] not null default '{}',
  add column business_type text not null default '',
  add constraint brands_reference_image_paths_max5
    check (array_length(reference_image_paths, 1) is null or array_length(reference_image_paths, 1) <= 5);

alter table public.brands
  alter column primary_color set default '#111111',
  alter column secondary_color set default '#FFFFFF';

-- Mesma função, mesmo schema (app_private, movida ali por
-- 202608010007_rpc_security_boundary.sql) — só amplia o upsert com os 3
-- campos novos e troca os dois literais de cor violeta pelos neutros, para
-- bater com o novo default da coluna.
create or replace function app_private.complete_my_onboarding(brand_input jsonb)
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
    heading_font, body_font, visual_style, logo_path, logomark_path,
    reference_image_paths, business_type, instagram_handle,
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
    coalesce(nullif(brand_input->>'primaryColor', ''), '#111111'),
    coalesce(nullif(brand_input->>'secondaryColor', ''), '#FFFFFF'),
    left(coalesce(nullif(brand_input->>'headingFont', ''), 'Inter'), 120),
    left(coalesce(nullif(brand_input->>'bodyFont', ''), 'Inter'), 120),
    coalesce(brand_input->>'visualStyle', ''), nullif(brand_input->>'logoUrl', ''),
    nullif(brand_input->>'logomarkUrl', ''),
    (select coalesce(array_agg(value), '{}') from (
      select value from jsonb_array_elements_text(coalesce(brand_input->'referenceImageUrls', '[]'::jsonb)) limit 5
    ) as capped(value)),
    coalesce(brand_input->>'businessType', ''),
    coalesce(brand_input->>'instagram', ''), coalesce((brand_input->>'instagramConnected')::boolean, false), true
  )
  on conflict (organization_id) where is_default do update set
    name = excluded.name, description = excluded.description, industry = excluded.industry,
    specialty = excluded.specialty, audience = excluded.audience, goals = excluded.goals,
    content_formats = excluded.content_formats, personality = excluded.personality,
    tone = excluded.tone, primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color, heading_font = excluded.heading_font,
    body_font = excluded.body_font, visual_style = excluded.visual_style,
    logo_path = excluded.logo_path, logomark_path = excluded.logomark_path,
    reference_image_paths = excluded.reference_image_paths,
    business_type = excluded.business_type,
    instagram_handle = excluded.instagram_handle,
    instagram_connected = excluded.instagram_connected
  returning * into saved;

  update public.profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = (select auth.uid());
  return saved;
end;
$$;
