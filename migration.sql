-- Run in Supabase SQL Editor (adds inventory, catalog, and sales features)
alter table products add column if not exists buying_price numeric default 0;
alter table products add column if not exists stock int default 0;
alter table products add column if not exists category text not null default 'Uncategorized';
alter table products add column if not exists is_featured boolean not null default false;
create table if not exists sales(
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  product_name text, qty int not null,
  buying_price numeric not null, selling_price numeric not null,
  created_at timestamptz default now());

create or replace function public.record_product_sale(
  p_product_id uuid,
  p_qty integer,
  p_selling_price numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  item products%rowtype;
begin
  if p_qty < 1 or p_selling_price < 0 then
    raise exception 'invalid_sale';
  end if;

  update products
  set stock = coalesce(stock, 0) - p_qty
  where id = p_product_id and coalesce(stock, 0) >= p_qty
  returning * into item;

  if not found then
    if exists (select 1 from products where id = p_product_id) then
      raise exception 'insufficient_stock';
    end if;
    raise exception 'product_not_found';
  end if;

  insert into sales (product_id, product_name, qty, buying_price, selling_price)
  values (item.id, item.name, p_qty, coalesce(item.buying_price, 0), p_selling_price);
end;
$$;

revoke all on function public.record_product_sale(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.record_product_sale(uuid, integer, numeric) to service_role;
