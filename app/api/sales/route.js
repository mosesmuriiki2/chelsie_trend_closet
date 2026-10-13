import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const db = sb();
  if (params.has('page') || params.has('limit')) {
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(params.get('limit') || '50', 10) || 50));
    const { data, error, count } = await db.from('sales')
      .select('id,product_id,order_id,product_name,qty,buying_price,selling_price,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sales: data, page, pageSize, total: count || 0 });
  }
  const { data, error } = await db.from('sales').select('*').order('created_at', { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const { product_id, qty, selling_price } = await req.json();
  const quantity = Number(qty);
  if (typeof product_id !== 'string' || !product_id ||
      !Number.isInteger(quantity) || quantity < 1 || (selling_price != null && (!Number.isFinite(Number(selling_price)) || Number(selling_price) < 0))) {
    return NextResponse.json({ error: 'Provide a product, a positive whole-number quantity, and a valid selling price.' }, { status: 400 });
  }
  const db = sb();
  const { data: product, error: productError } = await db.from('products').select('price').eq('id', product_id).maybeSingle();
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
  if (!product) return NextResponse.json({ error: 'That product no longer exists.' }, { status: 404 });
  const price = Number(selling_price ?? product.price);
  const { error } = await db.rpc('record_product_sale', {
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
