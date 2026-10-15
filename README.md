# Chelsie Trend Closet

A mobile-first fashion storefront with WhatsApp checkout and a password-protected store dashboard. Product images are uploaded to Supabase Storage; there is no paid image service, analytics package, cron job, or external AI service.

## Free-tier safety

- Deploy on Vercel Hobby and Supabase Free. The app does not use Vercel Image Optimization, Analytics, KV, Blob, Edge Config, paid Supabase add-ons, or scheduled jobs.
- Product photos are resized to at most 1,000 px wide and compressed to WebP under 200 KB in the browser. Upload at most six photos per product. The app removes replaced and deleted product photos from the `products` Storage bucket.
- Public product, category, and store-setting responses select storefront-safe columns only. Buying prices, customer orders, expenses, reports, stock movements, and sales are available only through cookie-authenticated server routes.
- Keep the Supabase service-role key in a server-only `SUPABASE_SERVICE_KEY` variable. Never add it to a `NEXT_PUBLIC_` variable.
- Supabase Free has storage and database quotas. Review unused photos, database usage, and Supabase limits periodically.
- Admin login throttling is in-memory and best-effort per running server instance; use a strong password and keep `SESSION_SECRET` private.

## Supabase setup

1. Create a Supabase project.
2. For a new project, create the base product table in the SQL Editor:

   ```sql
   create table products (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     price numeric not null,
     description text,
     sizes text,
     image_url text,
     created_at timestamptz default now()
   );
   ```

   Existing stores should keep their current `products` table and data.
3. Run the complete [migration.sql](./migration.sql) in the Supabase SQL Editor. It is additive and safe to rerun. It extends products and sales, adds categories, orders, order items, stock history, expenses, settings, trending keywords, indexes, RLS, and transaction-safe database functions.
4. In Supabase Storage, create a bucket named `products` and make it public so storefront photos can be displayed. Uploads and deletions are performed by the server using the service-role key.
5. Add the environment variables below in Vercel Project Settings or your local `.env.local`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in private values:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_KEY` | Supabase service-role secret. Server-side only; do not prefix with `NEXT_PUBLIC_`. |
| `ADMIN_PASSWORD` | Strong, unique dashboard password. |
| `SESSION_SECRET` | At least 32 random characters used to sign seven-day, HTTP-only admin sessions. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp destination in international format, e.g. `254712345678`, without spaces. Can also be configured in Store settings. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL used by metadata and sitemap. |

Generate a session secret locally with `openssl rand -base64 48`. Do not commit `.env.local`.

## Run locally

```sh
cp .env.example .env.local
npm install
npm run dev
```

Open `/` for the shop and `/admin` for the dashboard.

## Storefront and checkout

- Customers can browse categories, search, filter by size and price, sort, view product details and galleries, select size/colour, save a bag in local storage, and switch between English and Kiswahili.
- Checkout records an order and item/price snapshots before opening WhatsApp. If the database is unavailable, the WhatsApp message still opens with the order details.
- Store settings control the brand, announcement, theme, hero banners, WhatsApp number, currency, delivery fee (minimum KES 200 for delivery), free-delivery threshold, footer/contact content, social links, and WhatsApp message template. Pickup and orders meeting the configured free-delivery threshold remain free.
- The supplied shop logo is stored at `public/chelsie-logo.jpeg` and also supplies the browser icon.

## Admin guide

Sign in at `/admin`. Sessions are signed, HTTP-only, `SameSite=Lax`, and expire after seven days. Use **Sign out** on shared devices.

- **Overview:** select a date range to view complete-period sales, cost of goods, expenses, net profit, margin, order count, average order value, full-inventory stock value, order status counts, and revenue/profit trends.
- **Products:** add products with English/Kiswahili names and descriptions, prices, sizes, colours, stock, SKU, sale price, visibility, and up to six compressed photos. Edit product details, choose the cover by ordering image URLs, feature products, hide items, restock, and run bulk hide/category/restock actions.
- **Categories:** add, edit, hide, order, or delete storefront categories. Existing product category labels continue to work.
- **Orders:** search and filter incoming orders. Confirming an order deducts stock and creates sales rows atomically; cancelling restores deducted stock. Orders advance through confirmed, paid, and delivered.
- **Stock:** review movements and low-stock alerts. Restocks record quantity, current buying cost, and a supplier note.
- **Record sale:** record walk-in sales while atomically deducting stock.
- **Expenses:** record rent, transport, packaging, advertising, and other costs; the dashboard subtracts these from net profit.
- **Customers:** see customer order totals and message them directly on WhatsApp.
- **Reports:** review sales by day, week, month, product, or category. Download CSVs for sales, sizes, colours, inventory/sell-through, orders, expenses, customers, and order peak times.
- **Insights:** view estimated 7/14/30-day demand, recent actual-vs-forecast charts, reorder suggestions, weekday patterns, price-history associations, and stock with no sales in 30 days. Forecasts are planning estimates, not guarantees, and show a low-data note when sales history is sparse. Add manual style keywords to match against the catalogue.
- **Store settings:** configure branding, banners, theme colours, delivery, footer/contact/social content, default language, and the WhatsApp message template. Template placeholders include `{{order_number}}`, `{{customer_name}}`, `{{phone}}`, `{{items}}`, `{{subtotal}}`, `{{delivery_fee}}`, `{{total}}`, `{{delivery_area}}`, and `{{notes}}`.

## Deploy

Push the project to GitHub, import it into Vercel, add the environment variables above, deploy, and set `NEXT_PUBLIC_SITE_URL` to the production domain. Run the migration before enabling the new admin features.
