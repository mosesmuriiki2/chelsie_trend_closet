import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PUBLIC_SETTINGS = 'store_name,logo_url,tagline,theme_primary,theme_accent,theme_background,banners,announcement,whatsapp_number,currency,delivery_fee,free_delivery_threshold,social_links,about_text,contact_text,footer_text,default_language,whatsapp_template';
const EDITABLE_FIELDS = new Set([
  'store_name', 'logo_url', 'tagline', 'theme_primary', 'theme_accent', 'theme_background',
  'banners', 'announcement', 'whatsapp_number', 'currency', 'delivery_fee',
  'free_delivery_threshold', 'low_stock_threshold', 'social_links', 'about_text',
  'contact_text', 'footer_text', 'default_language', 'whatsapp_template',
]);

export async function GET(request) {
  const admin = isAdmin(request);
  const { data, error } = await sb().from('settings').select(admin ? '*' : PUBLIC_SETTINGS).eq('id', true).single();
  if (error) return NextResponse.json({ error: 'Store settings are unavailable. Run the latest database migration.' }, { status: 500 });
  const response = NextResponse.json(data);
  response.headers.set('Cache-Control', admin ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300');
  return response;
}

export async function PATCH(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to update store settings.' }, { status: 401 });
  const body = await request.json();
  const update = Object.fromEntries(Object.entries(body).filter(([key]) => EDITABLE_FIELDS.has(key)));
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No editable settings were provided.' }, { status: 400 });
  for (const field of ['store_name', 'tagline', 'announcement', 'about_text', 'contact_text', 'footer_text', 'whatsapp_template']) {
    if (update[field] != null && (typeof update[field] !== 'string' || update[field].length > 2000)) {
      return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be 2,000 characters or fewer.` }, { status: 400 });
    }
  }
  if (update.delivery_fee != null &&
      (!Number.isFinite(Number(update.delivery_fee)) || Number(update.delivery_fee) < 200)) {
    return NextResponse.json({ error: 'Delivery fee must be at least KES 200.' }, { status: 400 });
  }
  if (update.free_delivery_threshold != null &&
      (!Number.isFinite(Number(update.free_delivery_threshold)) || Number(update.free_delivery_threshold) < 0)) {
    return NextResponse.json({ error: 'Free delivery threshold must be a non-negative amount.' }, { status: 400 });
  }
  if (update.low_stock_threshold != null && (!Number.isInteger(Number(update.low_stock_threshold)) || Number(update.low_stock_threshold) < 0)) {
    return NextResponse.json({ error: 'Low-stock threshold must be a non-negative whole number.' }, { status: 400 });
  }
  if (update.default_language != null && !['en', 'sw'].includes(update.default_language)) {
    return NextResponse.json({ error: 'Default language must be English or Kiswahili.' }, { status: 400 });
  }
  if (update.currency != null) {
    if (typeof update.currency !== 'string' || !/^[A-Za-z]{3,4}$/.test(update.currency)) {
      return NextResponse.json({ error: 'Currency must be a three- or four-letter code.' }, { status: 400 });
    }
    update.currency = update.currency.toUpperCase();
  }
  for (const field of ['theme_primary', 'theme_accent', 'theme_background']) {
    if (update[field] != null && !/^#[0-9a-f]{6}$/i.test(update[field])) {
      return NextResponse.json({ error: 'Theme colours must use six-digit hexadecimal values.' }, { status: 400 });
    }
  }
  if (update.whatsapp_number != null && !/^[\d+()\s-]{7,30}$/.test(update.whatsapp_number)) {
    return NextResponse.json({ error: 'Enter a valid WhatsApp phone number.' }, { status: 400 });
  }
  if (update.logo_url != null && update.logo_url &&
      !(update.logo_url.startsWith('/') || update.logo_url.startsWith('https://'))) {
    return NextResponse.json({ error: 'Logo URL must be a site-relative path or secure https link.' }, { status: 400 });
  }
  if (update.banners != null) {
    if (!Array.isArray(update.banners) || update.banners.length > 8 || update.banners.some(banner =>
      !banner || typeof banner !== 'object' || Array.isArray(banner) ||
      typeof (banner.image_url || banner.image) !== 'string' ||
      !((banner.image_url || banner.image).startsWith('https://') || (banner.image_url || banner.image).startsWith('/')) ||
      (banner.button_link || banner.link) && !String(banner.button_link || banner.link).startsWith('https://') &&
        !String(banner.button_link || banner.link).startsWith('#'))) {
      return NextResponse.json({ error: 'Add up to eight banners with a secure image URL and safe button link.' }, { status: 400 });
    }
  }
  if (update.social_links != null && (!update.social_links || typeof update.social_links !== 'object' ||
    Array.isArray(update.social_links) || Object.keys(update.social_links).length > 12 ||
    Object.values(update.social_links).some(url => typeof url !== 'string' || !url.startsWith('https://') || url.length > 2048))) {
    return NextResponse.json({ error: 'Social links must be a JSON object of secure https URLs.' }, { status: 400 });
  }
  const { data, error } = await sb().from('settings').update({ ...update, updated_at: new Date().toISOString() }).eq('id', true).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
