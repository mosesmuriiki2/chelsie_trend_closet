import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ORDER_COLUMNS = 'id,order_number,customer_name,phone,delivery_area,street,delivery_method,payment_method,notes,subtotal,delivery_fee,total,status,created_at,updated_at';

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view customer orders.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const status = params.get('status');
  const search = params.get('q')?.trim().replace(/[%_,]/g, ' ').slice(0, 80);
  let query = sb().from('orders').select(`${ORDER_COLUMNS},order_items(id,product_id,product_name,size,colour,quantity,unit_price,line_total,image_url)`, { count: 'exact' });
  if (['new', 'confirmed', 'paid', 'delivered', 'cancelled'].includes(status)) query = query.eq('status', status);
  if (search) query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%,order_number.ilike.%${search}%`);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * 30, page * 30 - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data, page, total: count || 0 });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Order details are missing or invalid.' }, { status: 400 }); }
  const customer = body.customer;
  const items = body.items;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) {
    return NextResponse.json({ error: 'Enter your contact and delivery details.' }, { status: 400 });
  }
  const customerName = String(customer.customer_name || '').trim();
  const phone = String(customer.phone || '').trim();
  const area = String(customer.delivery_area || '').trim();
  const street = String(customer.street || '').trim();
  if (customerName.length < 2 || customerName.length > 120 || !/^[+\d][\d\s()+-]{6,28}$/.test(phone) ||
      (customer.delivery_method === 'delivery' && !area) || area.length > 120 || street.length > 180 ||
      (customer.delivery_method === 'delivery' && !street)) {
    return NextResponse.json({ error: 'Please check your name, phone number, and delivery location.' }, { status: 400 });
  }
  if (!['delivery', 'pickup'].includes(customer.delivery_method) ||
      !['mpesa_on_delivery', 'mpesa_before_delivery', 'cash'].includes(customer.payment_method)) {
    return NextResponse.json({ error: 'Choose a valid delivery and payment method.' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 25 ||
      items.some(item => !item || typeof item.product_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.product_id) ||
        !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 99)) {
    return NextResponse.json({ error: 'Your bag contains an invalid item. Please refresh the shop and try again.' }, { status: 400 });
  }

  const db = sb();
  const productIds = [...new Set(items.map(item => item.product_id))];
  const { data: products, error: productsError } = await db.from('products')
    .select('id,price,stock,sizes,colours').in('id', productIds).eq('is_visible', true);
  if (productsError) return NextResponse.json({ error: 'We could not verify your bag. Please try again.' }, { status: 503 });
  if (products.length !== productIds.length) return NextResponse.json({ error: 'One of these products is no longer available. Please refresh your bag.' }, { status: 409 });
  const productById = new Map(products.map(product => [product.id, product]));
  const quantityByProduct = new Map();
  for (const item of items) {
    const product = productById.get(item.product_id);
    const requestedSize = String(item.size || '').trim();
    const requestedColour = String(item.colour || '').trim();
    const sizes = String(product.sizes || '').split(',').map(value => value.trim()).filter(Boolean);
    const colours = Array.isArray(product.colours) ? product.colours : [];
    quantityByProduct.set(item.product_id, (quantityByProduct.get(item.product_id) || 0) + Number(item.quantity));
    if ((requestedSize && sizes.length && !sizes.includes(requestedSize)) ||
        (requestedColour && colours.length && !colours.includes(requestedColour))) {
      return NextResponse.json({ error: 'One of your selected sizes or colours is no longer available. Please refresh your bag.' }, { status: 409 });
    }
  }
  for (const [productId, quantity] of quantityByProduct) {
    if (Number(productById.get(productId).stock || 0) < quantity) {
      return NextResponse.json({ error: 'A product in your bag does not have enough stock. Please check your bag.' }, { status: 409 });
    }
  }
  const authoritativeSubtotal = items.reduce((sum, item) => sum + Number(productById.get(item.product_id).price) * Number(item.quantity), 0);
  const { data: settings, error: settingsError } = await db.from('settings').select('delivery_fee,free_delivery_threshold').eq('id', true).single();
  if (settingsError) return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please try WhatsApp directly.' }, { status: 503 });
  const deliveryFee = customer.delivery_method === 'pickup' ||
    (settings.free_delivery_threshold != null && authoritativeSubtotal >= Number(settings.free_delivery_threshold))
    ? 0 : Math.max(200, Number(settings.delivery_fee || 200));
  const safeCustomer = {
    customer_name: customerName,
    phone,
    delivery_area: area,
    street,
    delivery_method: customer.delivery_method,
    payment_method: customer.payment_method,
    notes: String(customer.notes || '').trim().slice(0, 1000),
  };
  const safeItems = items.map(item => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    size: String(item.size || '').slice(0, 40),
    colour: String(item.colour || '').slice(0, 40),
  }));
  const { data, error } = await db.rpc('create_shop_order', {
    p_customer: safeCustomer,
    p_items: safeItems,
    p_delivery_fee: deliveryFee,
  });
  if (error) {
    if (error.message.includes('product_unavailable')) return NextResponse.json({ error: 'One of these products is no longer available. Please refresh your bag.' }, { status: 409 });
    return NextResponse.json({ error: 'We could not save your order right now. You can still send your order through WhatsApp.' }, { status: 503 });
  }
  const order = Array.isArray(data) ? data[0] : data;
  const { data: orderItems, error: itemsError } = await db.from('order_items')
    .select('product_name,size,colour,quantity,unit_price,line_total,image_url')
    .eq('order_id', order.order_id);
  return NextResponse.json({
    ...order,
    items: itemsError ? null : orderItems,
  }, { status: 201 });
}
