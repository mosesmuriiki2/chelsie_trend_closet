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
  const quantity = Number(qty);
  const price = Number(selling_price);
  if (typeof product_id !== 'string' || !product_id ||
      !Number.isInteger(quantity) || quantity < 1 ||
      !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Provide a product, a positive whole-number quantity, and a valid selling price.' }, { status: 400 });
  }
  const { error } = await sb().rpc('record_product_sale', {
    p_product_id: product_id,
    p_qty: quantity,
    p_selling_price: price,
  });
  if (error) {
    if (error.message === 'insufficient_stock') return NextResponse.json({ error: 'There is not enough stock to record this sale.' }, { status: 400 });
    if (error.message === 'product_not_found') return NextResponse.json({ error: 'That product no longer exists.' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
