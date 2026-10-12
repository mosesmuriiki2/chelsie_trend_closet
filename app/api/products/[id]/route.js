import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });

export async function DELETE(req, { params }) {
  if (!isAdmin(req)) return deny();
  const { error } = await sb().from('products').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  if (!isAdmin(req)) return deny();
  const b = await req.json(); const db = sb();
  const { data: p } = await db.from('products').select('stock').eq('id', params.id).single();
  const upd = {};
  if (b.price != null) upd.price = Number(b.price);
  if (b.buying_price != null) upd.buying_price = Number(b.buying_price);
  if (b.addStock) upd.stock = (p?.stock || 0) + Number(b.addStock);
  const { error } = await db.from('products').update(upd).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
