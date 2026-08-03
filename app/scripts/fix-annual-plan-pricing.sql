-- Rode este script no Supabase Dashboard -> SQL Editor do projeto de produção.
-- Ele NÃO faz cobrança nem mexe no Stripe: só corrige o que a tabela
-- `plans` mostra dentro do app.
--
-- Regra aplicada ao plano anual ('year'):
--   preço   = 12x o preço mensal atual, com 20% de desconto
--   créditos = 100/mês * 12 = 1200/ano (sem desconto nos créditos)

begin;

update public.plans as annual
set
  price_cents = round(monthly.price_cents * 12 * 0.8),
  installments_count = 12,
  installments_value_cents = round(monthly.price_cents * 12 * 0.8 / 12),
  credits = 1200
from public.plans as monthly
where annual.id = 'year' and monthly.id = 'month';

-- Confira o resultado antes de commitar:
select id, name, price_cents, credits, installments_count, installments_value_cents
from public.plans
where id in ('month', 'year');

commit;
