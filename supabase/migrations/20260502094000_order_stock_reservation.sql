-- Atomic stock reservation helpers used by mobile checkout.

create or replace function public.decrement_product_stock(
  target_product_id uuid,
  decrement_by integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if decrement_by is null or decrement_by <= 0 then
    return false;
  end if;

  update public.product_catalog
  set stock = stock - decrement_by
  where id = target_product_id
    and stock >= decrement_by;

  return found;
end;
$$;

create or replace function public.increment_product_stock(
  target_product_id uuid,
  increment_by integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if increment_by is null or increment_by <= 0 then
    return;
  end if;

  update public.product_catalog
  set stock = stock + increment_by
  where id = target_product_id;
end;
$$;

grant execute on function public.decrement_product_stock(uuid, integer) to authenticated, service_role;
grant execute on function public.increment_product_stock(uuid, integer) to authenticated, service_role;
