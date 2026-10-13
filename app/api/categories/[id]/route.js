import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export async function PATCH(request, { params }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to manage categories.' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const update = {};
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name || name.length > 60) return NextResponse.json({ error: 'Category names must be between 1 and 60 characters.' }, { status: 400 });
    update.name = name;
    update.slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  if (body.sort_order != null) {
    if (!Number.isInteger(Number(body.sort_order))) return NextResponse.json({ error: 'Sort order must be a whole number.' }, { status: 400 });
    update.sort_order = Number(body.sort_order);
  }
  if (body.is_visible != null) {
    if (typeof body.is_visible !== 'boolean') return NextResponse.json({ error: 'Visibility must be true or false.' }, { status: 400 });
    update.is_visible = body.is_visible;
  }
  if (body.image_url !== undefined) {
    const imageUrl = body.image_url ? String(body.image_url).trim() : '';
    if (imageUrl.length > 2048 ||
      (imageUrl && !(imageUrl.startsWith('https://') || (imageUrl.startsWith('/') && !imageUrl.startsWith('//'))))) {
      return NextResponse.json({ error: 'Use a secure image URL or a site-relative path.' }, { status: 400 });
    }
    update.image_url = imageUrl || null;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No valid category changes were provided.' }, { status: 400 });
  const { data, error } = await sb().from('categories').update(update).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to manage categories.' }, { status: 401 });
  const { id } = await params;
  const { error } = await sb().from('categories').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
