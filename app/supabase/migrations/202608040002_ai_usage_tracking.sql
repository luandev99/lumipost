-- Custo real de IA por geração. Até aqui o bloco "usage" devolvido pela
-- OpenAI era descartado: dava para saber quantos créditos o cliente gastou,
-- mas não quanto a operação custou de fato. Sem isso não há como comparar
-- receita com custo nem perceber uma geração desproporcionalmente cara.
--
-- Uma linha por geração de conteúdo, somando todas as chamadas (copy + cada
-- imagem). O custo é calculado no servidor a partir da tabela de preços em
-- _shared/ai-pricing.ts e congelado aqui — preço de modelo muda com o tempo
-- e o histórico precisa continuar refletindo o custo da época.

create table if not exists public.ai_usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  generation_id uuid references public.content_generation_requests(id) on delete set null,
  content_id uuid references public.contents(id) on delete set null,
  format public.content_format not null,
  text_model text,
  image_model text,
  api_calls integer not null default 0 check (api_calls >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  -- Milésimos de centavo: uma imagem custa frações de centavo e arredondar
  -- para centavo inteiro zeraria a maior parte dos eventos.
  cost_millicents bigint not null default 0 check (cost_millicents >= 0),
  credits_charged integer not null default 0 check (credits_charged >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events(created_at desc);
create index if not exists ai_usage_events_org_created_idx
  on public.ai_usage_events(organization_id, created_at desc);

alter table public.ai_usage_events enable row level security;
alter table public.ai_usage_events force row level security;

-- Custo é informação de operação, não de cliente: só admin global lê. As
-- Edge Functions escrevem com service_role, que ignora RLS.
drop policy if exists ai_usage_events_select_admin on public.ai_usage_events;
create policy ai_usage_events_select_admin on public.ai_usage_events
for select to authenticated using (app_private.is_system_admin());

grant select on public.ai_usage_events to authenticated;

-- Teto mensal de gasto com IA. A OpenAI não expõe saldo restante por API
-- pública, então o "quanto ainda posso gastar" vem de um limite declarado
-- aqui e comparado com o consumo somado acima.
create table if not exists public.ai_cost_settings (
  id boolean primary key default true check (id),
  monthly_budget_cents integer not null default 0 check (monthly_budget_cents >= 0),
  updated_at timestamptz not null default now()
);

insert into public.ai_cost_settings (id, monthly_budget_cents)
values (true, 0)
on conflict (id) do nothing;

alter table public.ai_cost_settings enable row level security;
alter table public.ai_cost_settings force row level security;

drop policy if exists ai_cost_settings_select_admin on public.ai_cost_settings;
create policy ai_cost_settings_select_admin on public.ai_cost_settings
for select to authenticated using (app_private.is_system_admin());

drop policy if exists ai_cost_settings_update_admin on public.ai_cost_settings;
create policy ai_cost_settings_update_admin on public.ai_cost_settings
for update to authenticated
using (app_private.is_system_admin())
with check (app_private.is_system_admin());

grant select, update on public.ai_cost_settings to authenticated;
