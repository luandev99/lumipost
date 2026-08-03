-- Stripe identifiers are operational metadata, never secrets. Secrets remain
-- in Edge Function Secrets; these columns allow the current price to be rotated
-- by an administrator without redeploying a function.
alter table public.plans
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id text;

alter table public.credit_products
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id text;

-- New catalog records use the durable Stripe price id above. The legacy secret
-- reference remains supported for rows created before the catalogue existed.
alter table public.credit_products
  alter column stripe_price_secret_name drop not null;

alter table public.plans
  add constraint plans_stripe_product_id_check
    check (stripe_product_id is null or stripe_product_id ~ '^prod_') not valid,
  add constraint plans_stripe_price_id_check
    check (stripe_price_id is null or stripe_price_id ~ '^price_') not valid;

alter table public.credit_products
  add constraint credit_products_stripe_product_id_check
    check (stripe_product_id is null or stripe_product_id ~ '^prod_') not valid,
  add constraint credit_products_stripe_price_id_check
    check (stripe_price_id is null or stripe_price_id ~ '^price_') not valid;
