import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to update products.' }, { status: 401 });
  const body = await request.json();
  const ids = [...new Set(Array.isArray(body.ids) ? body.ids.filter(id => typeof id === 'string') : [])];
  if (!ids.length || ids.length > 100) return NextResponse.json({ error: 'Select between 1 and 100 products.' }, { status: 400 });
  const db = sb();
  if (body.action === 'hide') {
    const { error } = await db.from('products').update({ is_visible: false }).in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }
  if (body.action === 'category') {
    const category = String(body.category || '').trim();
    if (!category || category.length > 50) return NextResponse.json({ error: 'Enter a valid category.' }, { status: 400 });
    const { error } = await db.from('products').update({ category }).in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }
  if (body.action === 'restock') {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return NextResponse.json({ error: 'Restock quantity must be a positive whole number.' }, { status: 400 });
    }
    for (const id of ids) {
      const { error } = await db.rpc('restock_product', {
        p_product_id: id, p_quantity: quantity, p_buying_price: null,
        p_note: String(body.note || 'Bulk restock').slice(0, 300),
      });
      if (error) return NextResponse.json({ error: `Restock stopped after ${ids.length} selected items: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: ids.length });
  }
  return NextResponse.json({ error: 'Choose hide, category, or restock.' }, { status: 400 });
}
