import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const { data, error } = await sb().from('sales').select('*').order('created_at', { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const { product_id, qty, selling_price } = await req.json();
  const q = parseInt(qty), db = sb();
  const { data: p } = await db.from('products').select('*').eq('id', product_id).single();
  if (!p || !(q > 0)) return NextResponse.json({ error: 'Invalid sale' }, { status: 400 });
  if ((p.stock || 0) < q) return NextResponse.json({ error: `Only ${p.stock || 0} in stock` }, { status: 400 });
  // prices are snapshotted so history stays correct if prices change later
  const { error } = await db.from('sales').insert({
    product_id: p.id, product_name: p.name, qty: q,
    buying_price: p.buying_price || 0, selling_price: Number(selling_price ?? p.price),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from('products').update({ stock: p.stock - q }).eq('id', p.id);
  return NextResponse.json({ ok: true });
}
