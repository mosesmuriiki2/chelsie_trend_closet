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

-- Commerce extensions are additive so this file can be safely re-run.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  image_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists images text[] not null default '{}';
alter table public.products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.products add column if not exists colours text[] not null default '{}';
alter table public.products add column if not exists compare_at_price numeric;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists is_visible boolean not null default true;
alter table public.products add column if not exists name_sw text;
alter table public.products add column if not exists description_sw text;

update public.products
set images = array[image_url]
where coalesce(array_length(images, 1), 0) = 0 and image_url is not null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  phone text not null,
  delivery_area text not null default '',
  street text not null default '',
  delivery_method text not null default 'delivery',
  payment_method text not null default 'mpesa_on_delivery',
  notes text not null default '',
  subtotal numeric not null default 0,
  delivery_fee numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'new',
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (status in ('new', 'confirmed', 'paid', 'delivered', 'cancelled')),
  constraint orders_delivery_method_check check (delivery_method in ('delivery', 'pickup')),
  constraint orders_payment_method_check check (payment_method in ('mpesa_on_delivery', 'mpesa_before_delivery', 'cash'))
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  size text not null default '',
  colour text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  line_total numeric not null check (line_total >= 0),
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.sales add column if not exists order_id uuid references public.orders(id) on delete set null;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  movement_type text not null,
  quantity integer not null,
  unit_cost numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null default '',
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Chelsie Trend Closet',
  logo_url text,
  tagline text not null default 'Your style, your story',
  theme_primary text not null default '#E91E8C',
  theme_accent text not null default '#B0166B',
  theme_background text not null default '#FFF0F6',
  banners jsonb not null default '[]'::jsonb,
  announcement text not null default '',
  whatsapp_number text,
  currency text not null default 'KES',
  delivery_fee numeric not null default 200,
  free_delivery_threshold numeric,
  low_stock_threshold integer not null default 3,
  social_links jsonb not null default '{}'::jsonb,
  about_text text not null default '',
  contact_text text not null default '',
  footer_text text not null default '',
  default_language text not null default 'en',
  whatsapp_template text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (true) on conflict (id) do nothing;
update public.settings
set whatsapp_number = coalesce(nullif(trim(whatsapp_number), ''), '254717723059'),
    contact_text = coalesce(nullif(trim(contact_text), ''), 'Superior Center, 1st Floor, Shop F38, Kenyatta Avenue, opposite Kimathi Street'),
    delivery_fee = greatest(coalesce(delivery_fee, 200), 200)
where id = true;

create table if not exists public.trending_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence if not exists public.order_number_seq start with 1042;

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_visible_created_idx on public.products(is_visible, created_at desc);
create index if not exists products_featured_idx on public.products(is_featured) where is_featured;
create index if not exists products_sku_idx on public.products(sku) where sku is not null;
create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sales_product_created_idx on public.sales(product_id, created_at desc);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_created_at_idx on public.orders(status, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_created_at_idx on public.order_items(created_at desc);
create index if not exists stock_movements_product_created_idx on public.stock_movements(product_id, created_at desc);
create index if not exists expenses_created_at_idx on public.expenses(created_at desc);
create index if not exists trending_keywords_active_created_idx on public.trending_keywords(is_active, created_at desc);

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.categories enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;
alter table public.trending_keywords enable row level security;

create or replace function public.create_shop_order(
  p_customer jsonb,
  p_items jsonb,
  p_delivery_fee numeric
)
returns table(order_id uuid, order_number text, order_subtotal numeric, order_total numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  product_row public.products%rowtype;
  inserted_order_id uuid;
  generated_number text;
  calculated_subtotal numeric := 0;
  item_quantity integer;
  item_price numeric;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 25 then
    raise exception 'invalid_order_items';
  end if;
  if coalesce(length(trim(p_customer->>'customer_name')), 0) not between 1 and 120
    or coalesce(length(trim(p_customer->>'phone')), 0) not between 7 and 30 then
    raise exception 'invalid_customer';
  end if;
  if p_delivery_fee < 0 then raise exception 'invalid_delivery_fee'; end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (item->>'quantity')::integer;
    if item_quantity < 1 or item_quantity > 99 then raise exception 'invalid_quantity'; end if;
    select * into product_row from public.products
      where id = (item->>'product_id')::uuid and coalesce(is_visible, true) = true;
    if not found then raise exception 'product_unavailable'; end if;
    item_price := greatest(coalesce(product_row.price, 0), 0);
    calculated_subtotal := calculated_subtotal + item_price * item_quantity;
  end loop;

  generated_number := 'CTC-' || nextval('public.order_number_seq')::text;
  insert into public.orders (
    order_number, customer_name, phone, delivery_area, street, delivery_method,
    payment_method, notes, subtotal, delivery_fee, total
  ) values (
    generated_number,
    trim(p_customer->>'customer_name'),
    trim(p_customer->>'phone'),
    coalesce(trim(p_customer->>'delivery_area'), ''),
    coalesce(trim(p_customer->>'street'), ''),
    coalesce(p_customer->>'delivery_method', 'delivery'),
    coalesce(p_customer->>'payment_method', 'mpesa_on_delivery'),
    left(coalesce(p_customer->>'notes', ''), 1000),
    calculated_subtotal,
    p_delivery_fee,
    calculated_subtotal + p_delivery_fee
  ) returning id into inserted_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    select * into product_row from public.products where id = (item->>'product_id')::uuid;
    item_quantity := (item->>'quantity')::integer;
    item_price := greatest(coalesce(product_row.price, 0), 0);
    insert into public.order_items (
      order_id, product_id, product_name, size, colour, quantity, unit_price, line_total, image_url
    ) values (
      inserted_order_id, product_row.id, product_row.name,
      left(coalesce(item->>'size', ''), 40), left(coalesce(item->>'colour', ''), 40),
      item_quantity, item_price, item_price * item_quantity,
      coalesce(product_row.images[1], product_row.image_url)
    );
  end loop;

  return query select inserted_order_id, generated_number, calculated_subtotal, calculated_subtotal + p_delivery_fee;
end;
$$;

create or replace function public.set_shop_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  item_row public.order_items%rowtype;
  product_row public.products%rowtype;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if p_status not in ('confirmed', 'paid', 'delivered', 'cancelled') then raise exception 'invalid_status'; end if;
  if order_row.status in ('delivered', 'cancelled') then raise exception 'order_closed'; end if;

  if p_status = 'confirmed' and order_row.status = 'new' then
    for item_row in select * from public.order_items where order_id = p_order_id
    loop
      if item_row.product_id is null then raise exception 'product_unavailable'; end if;
      update public.products set stock = coalesce(stock, 0) - item_row.quantity
        where id = item_row.product_id and coalesce(stock, 0) >= item_row.quantity
        returning * into product_row;
      if not found then raise exception 'insufficient_stock'; end if;
      insert into public.sales (product_id, order_id, product_name, qty, buying_price, selling_price)
      values (product_row.id, p_order_id, item_row.product_name, item_row.quantity,
        coalesce(product_row.buying_price, 0), item_row.unit_price);
      insert into public.stock_movements (product_id, order_id, movement_type, quantity, unit_cost, note)
      values (product_row.id, p_order_id, 'sale', -item_row.quantity,
        coalesce(product_row.buying_price, 0), order_row.order_number);
    end loop;
    update public.orders set status = 'confirmed', stock_deducted = true, updated_at = now()
      where id = p_order_id;
    return;
  end if;

  if p_status = 'paid' and order_row.status = 'confirmed' then
    update public.orders set status = 'paid', updated_at = now() where id = p_order_id;
    return;
  end if;

  if p_status = 'delivered' and order_row.status = 'paid' then
    update public.orders set status = 'delivered', updated_at = now() where id = p_order_id;
    return;
  end if;

  if p_status = 'cancelled' then
    if order_row.stock_deducted then
      for item_row in select * from public.order_items where order_id = p_order_id
      loop
        if item_row.product_id is not null then
          update public.products set stock = coalesce(stock, 0) + item_row.quantity
            where id = item_row.product_id returning * into product_row;
          insert into public.stock_movements (product_id, order_id, movement_type, quantity, unit_cost, note)
          values (product_row.id, p_order_id, 'return', item_row.quantity,
            coalesce(product_row.buying_price, 0), order_row.order_number);
        end if;
      end loop;
    end if;
    delete from public.sales where order_id = p_order_id;
    update public.orders set status = 'cancelled', stock_deducted = false, updated_at = now()
      where id = p_order_id;
    return;
  end if;

  raise exception 'invalid_status_transition';
end;
$$;

revoke all on function public.create_shop_order(jsonb, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.set_shop_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.create_shop_order(jsonb, jsonb, numeric) to service_role;
grant execute on function public.set_shop_order_status(uuid, text) to service_role;
grant usage, select on sequence public.order_number_seq to service_role;

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
  item public.products%rowtype;
begin
  if p_qty < 1 or p_selling_price < 0 then raise exception 'invalid_sale'; end if;
  update public.products set stock = coalesce(stock, 0) - p_qty
    where id = p_product_id and coalesce(stock, 0) >= p_qty returning * into item;
  if not found then
    if exists (select 1 from public.products where id = p_product_id) then raise exception 'insufficient_stock'; end if;
    raise exception 'product_not_found';
  end if;
  insert into public.sales (product_id, product_name, qty, buying_price, selling_price)
    values (item.id, item.name, p_qty, coalesce(item.buying_price, 0), p_selling_price);
  insert into public.stock_movements (product_id, movement_type, quantity, unit_cost, note)
    values (item.id, 'sale', -p_qty, coalesce(item.buying_price, 0), 'Manual sale');
end;
$$;

revoke all on function public.record_product_sale(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.record_product_sale(uuid, integer, numeric) to service_role;

create or replace function public.restock_product(
  p_product_id uuid,
  p_quantity integer,
  p_buying_price numeric default null,
  p_note text default ''
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  item public.products%rowtype;
begin
  if p_quantity < 1 then raise exception 'invalid_quantity'; end if;
  if p_buying_price is not null and p_buying_price < 0 then raise exception 'invalid_buying_price'; end if;
  update public.products set
    stock = coalesce(stock, 0) + p_quantity,
    buying_price = coalesce(p_buying_price, buying_price)
    where id = p_product_id returning * into item;
  if not found then raise exception 'product_not_found'; end if;
  insert into public.stock_movements (product_id, movement_type, quantity, unit_cost, note)
    values (item.id, 'restock', p_quantity, coalesce(item.buying_price, 0), left(coalesce(p_note, ''), 300));
end;
$$;

revoke all on function public.restock_product(uuid, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.restock_product(uuid, integer, numeric, text) to service_role;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('products', 'sales', 'categories', 'orders', 'order_items',
        'stock_movements', 'expenses', 'settings', 'trending_keywords')
  loop
    execute format('drop policy if exists %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

grant select, insert, update, delete on public.products, public.sales, public.categories,
  public.orders, public.order_items, public.stock_movements, public.expenses,
  public.settings, public.trending_keywords to service_role;
