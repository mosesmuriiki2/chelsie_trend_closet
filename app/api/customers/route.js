import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view customers.' }, { status: 401 });
  const db = sb();
  const data = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data: batch, error } = await db.from('orders')
      .select('customer_name,phone,total,status,created_at')
      .neq('status', 'cancelled').order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data.push(...batch);
    if (batch.length < 1000) break;
  }

  const grouped = new Map();
  for (const order of data) {
    const customer = grouped.get(order.phone) || {
      phone: order.phone, name: order.customer_name, order_count: 0,
      total_spent: 0, last_order_at: order.created_at,
    };
    customer.order_count += 1;
    customer.total_spent += Number(order.total || 0);
    if (new Date(order.created_at) > new Date(customer.last_order_at)) {
      customer.last_order_at = order.created_at;
      customer.name = order.customer_name;
    }
    grouped.set(order.phone, customer);
  }
  return NextResponse.json([...grouped.values()].sort((a, b) =>
    b.order_count - a.order_count || new Date(b.last_order_at) - new Date(a.last_order_at)));
}
