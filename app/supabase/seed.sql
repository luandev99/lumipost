-- Public product catalog only. Never put credentials or production user data in this file.
-- O preço do plano anual deve ser sempre 12x o mensal com 20% de desconto
-- (4790 * 12 * 0.8 = 45984 centavos; parcela = 45984 / 12 = 3832 centavos).
-- Não digite o valor anual solto: veja o UPDATE de recálculo logo abaixo.
-- Créditos do anual: só o preço tem desconto, o ritmo de créditos
-- continua 100/mês -> 1200/ano (100 * 12).
insert into public.plans (
  id, name, price_cents, credits, duration_days, available, featured, badge,
  installments_count, installments_value_cents, stripe_price_secret_name
) values
  ('week', 'Semanal', 2490, 50, 7, false, false, null, null, null, null),
  ('month', 'Lumipost Mensal', 4790, 120, 30, true, false, null, null, null, 'STRIPE_PRICE_MONTH'),
  ('year', 'Lumipost Anual', 45984, 1200, 365, true, true, 'Melhor valor', 12, 3832, 'STRIPE_PRICE_YEAR')
on conflict (id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  credits = excluded.credits,
  duration_days = excluded.duration_days,
  available = excluded.available,
  featured = excluded.featured,
  badge = excluded.badge,
  installments_count = excluded.installments_count,
  installments_value_cents = excluded.installments_value_cents,
  stripe_price_secret_name = excluded.stripe_price_secret_name;

-- Recalcula o anual a partir do preço mensal atual, para que a regra
-- "12x o mensal - 20%" nunca fique desatualizada neste seed.
update public.plans as annual
set
  price_cents = round(monthly.price_cents * 12 * 0.8),
  installments_count = 12,
  installments_value_cents = round(monthly.price_cents * 12 * 0.8 / 12)
from public.plans as monthly
where annual.id = 'year' and monthly.id = 'month';

insert into public.credit_products (
  id, name, credits, price_cents, stripe_price_secret_name, available, featured, position
) values
  ('credits_50', '50 créditos adicionais', 50, 1990, 'STRIPE_PRICE_CREDITS_50', true, false, 10),
  ('credits_150', '150 créditos adicionais', 150, 4990, 'STRIPE_PRICE_CREDITS_150', true, true, 20),
  ('credits_400', '400 créditos adicionais', 400, 10990, 'STRIPE_PRICE_CREDITS_400', true, false, 30)
on conflict (id) do update set
  name = excluded.name,
  credits = excluded.credits,
  price_cents = excluded.price_cents,
  stripe_price_secret_name = excluded.stripe_price_secret_name,
  available = excluded.available,
  featured = excluded.featured,
  position = excluded.position;
