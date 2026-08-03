-- Public catalog rows must not require execution of private admin helpers.

drop policy if exists plans_select_available on public.plans;
create policy plans_select_available_anon on public.plans
for select to anon using (available);
create policy plans_select_available_authenticated on public.plans
for select to authenticated using (available or app_private.is_system_admin());

drop policy if exists credit_products_select_available on public.credit_products;
create policy credit_products_select_available_anon on public.credit_products
for select to anon using (available);
create policy credit_products_select_available_authenticated on public.credit_products
for select to authenticated using (available or app_private.is_system_admin());
