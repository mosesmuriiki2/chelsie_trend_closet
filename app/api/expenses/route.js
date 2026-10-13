import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view expenses.' }, { status: 401 });
  const page = Math.max(1, Number.parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1);
  const { data, error, count } = await sb().from('expenses')
    .select('id,category,description,amount,created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data, page, total: count || 0 });
}

export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to record expenses.' }, { status: 401 });
  const body = await request.json();
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);
  if (!category || category.length > 80 || description.length > 300 || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an expense category, a short description, and an amount above zero.' }, { status: 400 });
  }
  const { data, error } = await sb().from('expenses')
    .insert({ category, description, amount }).select('id,category,description,amount,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
