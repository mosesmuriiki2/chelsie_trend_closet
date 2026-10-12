import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });

export async function DELETE(req, { params }) {
  if (!isAdmin(req)) return deny();
  const { id } = await params;
  const { error } = await sb().from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  if (!isAdmin(req)) return deny();
  const { id } = await params;
  const b = await req.json();
  const db = sb();
  const { data: p, error: lookupError } = await db.from('products').select('stock').eq('id', id).single();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 404 });
  const upd = {};
  if (b.price != null) {
    if (!Number.isFinite(Number(b.price)) || Number(b.price) < 0) return NextResponse.json({ error: 'Price must be a non-negative number.' }, { status: 400 });
    upd.price = Number(b.price);
  }
  if (b.buying_price != null) {
    if (!Number.isFinite(Number(b.buying_price)) || Number(b.buying_price) < 0) return NextResponse.json({ error: 'Buying price must be a non-negative number.' }, { status: 400 });
    upd.buying_price = Number(b.buying_price);
  }
  if (b.addStock != null) {
    const amount = Number(b.addStock);
    if (!Number.isInteger(amount) || amount < 1) return NextResponse.json({ error: 'Restock quantity must be a positive whole number.' }, { status: 400 });
    upd.stock = (p.stock || 0) + amount;
  }
  if (b.category != null) {
    const category = String(b.category).trim();
    if (!category || category.length > 50) return NextResponse.json({ error: 'Category must be between 1 and 50 characters.' }, { status: 400 });
    upd.category = category;
  }
  if (b.is_featured != null) {
    if (typeof b.is_featured !== 'boolean') return NextResponse.json({ error: 'Popular status must be true or false.' }, { status: 400 });
    upd.is_featured = b.is_featured;
  }
  if (!Object.keys(upd).length) return NextResponse.json({ error: 'No valid product changes were provided.' }, { status: 400 });
  const { error } = await db.from('products').update(upd).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
