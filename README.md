# Chelsie Trend Closet

## 1. Supabase (free) – supabase.com
Create a project, then in SQL Editor run:

    create table products(
      id uuid primary key default gen_random_uuid(),
      name text not null, price numeric not null,
      description text, sizes text, image_url text,
      created_at timestamptz default now());

Storage -> New bucket named `products` -> tick **Public bucket**.
Settings -> API: copy the Project URL and the `service_role` key.

If you already ran the first SQL, just run `migration.sql` instead of re-creating the table.
(New setups: run the SQL above, then `migration.sql`.)

## 2. Run locally
    cp .env.example .env.local   # fill in values
    npm install && npm run dev

## 3. Deploy on Vercel (free)
Push to GitHub -> vercel.com -> Add New Project -> import repo ->
add the 4 variables from .env.example -> Deploy.

Shop: `/`   Admin: `/admin`
WhatsApp number format: country code, no + or spaces (e.g. 254712345678).
