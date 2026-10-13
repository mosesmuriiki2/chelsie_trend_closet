import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to manage trending styles.' }, { status: 401 });
  const { data, error } = await sb().from('trending_keywords').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to manage trending styles.' }, { status: 401 });
  const body = await request.json();
  const keyword = String(body.keyword || '').trim();
  const linkUrl = String(body.link_url || '').trim();
  if (!keyword || keyword.length > 80 || (linkUrl && (!linkUrl.startsWith('https://') || linkUrl.length > 2048))) {
    return NextResponse.json({ error: 'Enter a trend keyword and, optionally, a secure https link.' }, { status: 400 });
  }
  const { data, error } = await sb().from('trending_keywords')
    .insert({ keyword, link_url: linkUrl || null }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to manage trending styles.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Choose a trend to remove.' }, { status: 400 });
  const { error } = await sb().from('trending_keywords').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
