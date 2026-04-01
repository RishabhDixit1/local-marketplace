-- Allow anonymous (public) visitors to read service listings and product catalog.
-- Previously SELECT was restricted to authenticated users only, which meant
-- any visitor who was not signed in saw an empty Store tab.

drop policy if exists service_listings_select_anon on public.service_listings;
create policy service_listings_select_anon
on public.service_listings
for select
to anon
using (true);

drop policy if exists product_catalog_select_anon on public.product_catalog;
create policy product_catalog_select_anon
on public.product_catalog
for select
to anon
using (true);
