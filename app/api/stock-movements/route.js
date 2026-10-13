import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view stock history.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  let query = sb().from('stock_movements').select(
    'id,product_id,order_id,movement_type,quantity,unit_cost,note,created_at,products(name,sku)',
    { count: 'exact' },
  );
  if (params.get('product_id')) query = query.eq('product_id', params.get('product_id'));
  const { data, error, count } = await query.order('created_at', { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movements: data, page, total: count || 0 });
}
