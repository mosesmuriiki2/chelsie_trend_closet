import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const admin = isAdmin(request);
  const query = sb().from('categories').select(admin ? '*' : 'id,name,slug,image_url,sort_order')
    .order('sort_order').order('name').limit(100);
  if (!admin) query.eq('is_visible', true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const response = NextResponse.json(data);
  response.headers.set('Cache-Control', admin ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300');
  return response;
}

export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to manage categories.' }, { status: 401 });
  const body = await request.json();
  const name = String(body.name || '').trim();
  if (!name || name.length > 60) return NextResponse.json({ error: 'Category names must be between 1 and 60 characters.' }, { status: 400 });
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';
  if (imageUrl && (imageUrl.length > 2048 ||
    !(imageUrl.startsWith('https://') || (imageUrl.startsWith('/') && !imageUrl.startsWith('//'))))) {
    return NextResponse.json({ error: 'Use a secure image URL or a site-relative path.' }, { status: 400 });
  }
  const slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { data, error } = await sb().from('categories').insert({
    name, slug, image_url: imageUrl || null,
    sort_order: Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0,
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'A category with that name already exists.' : error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
