import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export async function PATCH(request, { params }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to update orders.' }, { status: 401 });
  const { id } = await params;
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Choose an order status.' }, { status: 400 }); }
  const status = body.status;
  if (!['confirmed', 'paid', 'delivered', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Choose a valid order status.' }, { status: 400 });
  }
  const { error } = await sb().rpc('set_shop_order_status', { p_order_id: id, p_status: status });
  if (error) {
    const messages = {
      order_not_found: 'That order could not be found.',
      insufficient_stock: 'There is not enough stock to confirm this order. Update stock and try again.',
      product_unavailable: 'An item in this order no longer exists.',
      order_closed: 'This order has already been completed or cancelled.',
      invalid_status_transition: 'That status change is not allowed.',
    };
    const message = Object.entries(messages).find(([key]) => error.message.includes(key))?.[1];
    return NextResponse.json({ error: message || 'We could not update this order.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
