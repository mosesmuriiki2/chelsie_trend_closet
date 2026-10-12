# Chelsie Trend Closet

## 1. Supabase – supabase.com
Create a project, then in SQL Editor run this table definition for a new setup:

    create table products(
      id uuid primary key default gen_random_uuid(),
      name text not null, price numeric not null,
      description text, sizes text, image_url text,
      created_at timestamptz default now());

For both new and existing setups, run `migration.sql` after the table exists. It adds inventory and catalog fields, creates sales tracking, and installs the atomic stock-and-sale operation.

Storage -> New bucket named `products` -> tick **Public bucket**.
Settings -> API: copy the Project URL and the `service_role` key.

To show categories on the shop, set each product's category in the admin dashboard. Mark products as popular in Inventory to feature them on the storefront.

## 2. Run locally
    cp .env.example .env.local   # fill in values
    npm install && npm run dev

## 3. Deploy on Vercel (free)
Push to GitHub -> vercel.com -> Add New Project -> import repo ->
add the 4 variables from .env.example -> Deploy.

Shop: `/`   Admin: `/admin`
WhatsApp number format: country code, no + or spaces (e.g. 254712345678).
