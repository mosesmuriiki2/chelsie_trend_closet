-- Run in Supabase SQL Editor (adds stock + sales tracking)
alter table products add column if not exists buying_price numeric default 0;
alter table products add column if not exists stock int default 0;
create table if not exists sales(
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  product_name text, qty int not null,
  buying_price numeric not null, selling_price numeric not null,
  created_at timestamptz default now());
