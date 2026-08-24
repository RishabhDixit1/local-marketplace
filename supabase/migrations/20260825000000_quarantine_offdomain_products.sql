-- Quarantine off-domain rows inserted directly into product_catalog.
-- Live DB had non-marketplace entries ("Government Grants & Startup Schemes",
-- "Angel Investors & Venture Capital Connect") showing up in the Products feed.
--
-- Deploy this BEFORE deploying the app/api/products change that filters on
-- is_active, otherwise the products endpoint will fail on the missing column.

alter table public.product_catalog
  add column if not exists is_active boolean not null default true;

-- Quarantine by title pattern (covers the known bad rows and near-duplicates).
update public.product_catalog
set is_active = false,
    updated_at = timezone('utc', now())
where is_active
  and (
    title ilike '%government%grant%'
    or title ilike '%startup%scheme%'
    or title ilike '%angel%investor%'
    or title ilike '%venture%capital%'
    or category ilike '%funding%'
    or category ilike '%investment%'
  );

-- Partial index so the products browse path stays fast on active rows only.
create index if not exists idx_product_catalog_active
  on public.product_catalog (created_at desc)
  where is_active;
