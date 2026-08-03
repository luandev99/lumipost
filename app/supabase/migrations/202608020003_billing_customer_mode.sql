-- Clientes Stripe de teste e produção vivem em contas distintas.
alter table public.billing_customers
  add column if not exists stripe_livemode boolean not null default false;

-- Registros antigos não têm origem confiável; ao alternar ambiente, a Edge Function
-- cria um Customer novo no ambiente correto sem reutilizar um id incompatível.
update public.billing_customers
set stripe_livemode = true
where stripe_livemode = false;
