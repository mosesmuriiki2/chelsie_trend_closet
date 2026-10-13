import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function readAll(db, table, columns, start, end) {
  const rows = [];
  for (let from = 0; from < 10000; from += 1000) {
    let query = db.from(table).select(columns).order('created_at', { ascending: true }).range(from, from + 999);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function csvResponse(name, columns, rows) {
  const content = [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  return new Response(`\uFEFF${content}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view reports.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const type = params.get('type') || 'sales';
  const start = params.get('from');
  const end = params.get('to');
  const asCsv = params.get('format') === 'csv';
  if ((start && Number.isNaN(Date.parse(start))) || (end && Number.isNaN(Date.parse(end))) ||
      (start && end && new Date(start) > new Date(end))) {
    return NextResponse.json({ error: 'Choose a valid report date range.' }, { status: 400 });
  }
  const db = sb();

  try {
    if (type === 'inventory') {
      const { data, error } = await db.from('products')
        .select('id,name,sku,category,stock,buying_price,price,compare_at_price,is_visible')
        .order('name').limit(5000);
      if (error) throw new Error(error.message);
      const sales = await readAll(db, 'sales', 'product_id,qty,created_at', null, null);
      const unitsByProduct = new Map();
      for (const sale of sales) {
        unitsByProduct.set(sale.product_id, (unitsByProduct.get(sale.product_id) || 0) + Number(sale.qty || 0));
      }
      const rows = data.map(item => ({
        ...item,
        stock_cost: Number(item.stock || 0) * Number(item.buying_price || 0),
        stock_retail: Number(item.stock || 0) * Number(item.price || 0),
        units_sold: unitsByProduct.get(item.id) || 0,
        sell_through_percent: (Number(item.stock || 0) + (unitsByProduct.get(item.id) || 0))
          ? (unitsByProduct.get(item.id) || 0) / (Number(item.stock || 0) + (unitsByProduct.get(item.id) || 0)) * 100 : 0,
      }));
      if (asCsv) return csvResponse('inventory-report', ['name', 'sku', 'category', 'stock', 'buying_price', 'price', 'stock_cost', 'stock_retail', 'units_sold', 'sell_through_percent', 'is_visible'],
        rows.map(({ name, sku, category, stock, buying_price, price, stock_cost, stock_retail, units_sold, sell_through_percent, is_visible }) =>
          [name, sku, category, stock, buying_price, price, stock_cost, stock_retail, units_sold, sell_through_percent.toFixed(2), is_visible]));
      return NextResponse.json(rows);
    }
    if (type === 'customers') {
      const orders = await readAll(db, 'orders', 'customer_name,phone,status,total,created_at', start, end);
      const grouped = new Map();
      for (const order of orders) {
        if (order.status === 'cancelled') continue;
        const customer = grouped.get(order.phone) || {
          phone: order.phone, name: order.customer_name, order_count: 0, total_spent: 0, last_order_at: order.created_at,
        };
        customer.order_count += 1;
        customer.total_spent += Number(order.total || 0);
        if (order.created_at > customer.last_order_at) {
          customer.last_order_at = order.created_at;
          customer.name = order.customer_name;
        }
        grouped.set(order.phone, customer);
      }
      const report = [...grouped.values()].sort((a, b) => b.order_count - a.order_count);
      if (asCsv) return csvResponse('customer-report', ['name', 'phone', 'order_count', 'total_spent', 'last_order_at'],
        report.map(customer => [customer.name, customer.phone, customer.order_count, customer.total_spent, customer.last_order_at]));
      return NextResponse.json(report);
    }
    if (type === 'peak-times') {
      const orders = await readAll(db, 'orders', 'status,created_at', start, end);
      const buckets = new Map();
      const localFormatter = new Intl.DateTimeFormat('en', {
        timeZone: 'Africa/Nairobi', weekday: 'long', hour: '2-digit', hourCycle: 'h23',
      });
      for (const order of orders) {
        const created = new Date(order.created_at);
        const parts = Object.fromEntries(localFormatter.formatToParts(created).map(part => [part.type, part.value]));
        const weekday = parts.weekday;
        const hour = Number(parts.hour);
        const key = `${weekday} ${String(hour).padStart(2, '0')}:00`;
        const row = buckets.get(key) || { weekday, hour, orders: 0, cancelled: 0 };
        row.orders += 1;
        if (order.status === 'cancelled') row.cancelled += 1;
        buckets.set(key, row);
      }
      const report = [...buckets.values()].sort((a, b) => a.weekday.localeCompare(b.weekday) || a.hour - b.hour);
      if (asCsv) return csvResponse('orders-by-weekday-hour', ['weekday', 'hour_africa_nairobi', 'orders', 'cancelled'],
        report.map(row => [row.weekday, `${String(row.hour).padStart(2, '0')}:00`, row.orders, row.cancelled]));
      return NextResponse.json(report);
    }
    if (type === 'orders') {
      const orders = await readAll(db, 'orders', 'order_number,customer_name,phone,status,subtotal,delivery_fee,total,created_at', start, end);
      if (asCsv) return csvResponse('orders-report', ['order_number', 'customer_name', 'phone', 'status', 'subtotal', 'delivery_fee', 'total', 'created_at'],
        orders.map(order => [order.order_number, order.customer_name, order.phone, order.status, order.subtotal, order.delivery_fee, order.total, order.created_at]));
      return NextResponse.json(orders);
    }
    if (type === 'expenses') {
      const expenses = await readAll(db, 'expenses', 'category,description,amount,created_at', start, end);
      if (asCsv) return csvResponse('expense-report', ['category', 'description', 'amount', 'created_at'],
        expenses.map(expense => [expense.category, expense.description, expense.amount, expense.created_at]));
      return NextResponse.json(expenses);
    }
    if (type === 'variants') {
      const variants = await readAll(db, 'order_items', 'size,colour,quantity,line_total,created_at,orders!inner(status)', start, end);
      const selected = params.get('variant') === 'colour' ? 'colour' : 'size';
      const buckets = new Map();
      for (const item of variants) {
        if (item.orders?.status === 'cancelled') continue;
        const label = item[selected] || 'Not specified';
        const row = buckets.get(label) || { label, revenue: 0, units: 0 };
        row.revenue += Number(item.line_total || 0);
        row.units += Number(item.quantity || 0);
        buckets.set(label, row);
      }
      const report = [...buckets.values()].sort((a, b) => b.revenue - a.revenue);
      if (asCsv) return csvResponse(`sales-by-${selected}`, [selected, 'revenue', 'units_sold'],
        report.map(row => [row.label, row.revenue, row.units]));
      return NextResponse.json(report);
    }

    const sales = await readAll(db, 'sales', 'product_id,product_name,qty,buying_price,selling_price,created_at,order_id', start, end);
    const group = params.get('group') || 'day';
    if (!['day', 'week', 'month', 'product', 'category'].includes(group)) {
      return NextResponse.json({ error: 'Choose a supported sales report breakdown.' }, { status: 400 });
    }
    const buckets = new Map();
    let categoryByProduct = new Map();
    if (group === 'category') {
      const { data: products, error } = await db.from('products').select('id,category').limit(5000);
      if (error) throw new Error(error.message);
      categoryByProduct = new Map(products.map(product => [product.id, product.category || 'Uncategorized']));
    }
    for (const sale of sales) {
      const date = new Date(sale.created_at);
      let key = group === 'category' ? categoryByProduct.get(sale.product_id) || 'Uncategorized' : sale.product_name;
      if (group === 'day') key = date.toISOString().slice(0, 10);
      if (group === 'month') key = date.toISOString().slice(0, 7);
      if (group === 'week') {
        const week = new Date(date);
        week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
        key = week.toISOString().slice(0, 10);
      }
      const row = buckets.get(key) || { label: key, revenue: 0, cogs: 0, profit: 0, units: 0, orders: new Set() };
      const revenue = Number(sale.selling_price) * Number(sale.qty);
      const cogs = Number(sale.buying_price) * Number(sale.qty);
      row.revenue += revenue;
      row.cogs += cogs;
      row.profit += revenue - cogs;
      row.units += Number(sale.qty);
      if (sale.order_id) row.orders.add(sale.order_id);
      buckets.set(key, row);
    }
    const report = [...buckets.values()].map(row => ({
      ...row, orders: row.orders.size, margin: row.revenue ? row.profit / row.revenue * 100 : 0,
    })).sort((a, b) => a.label.localeCompare(b.label));
    if (asCsv) return csvResponse(`sales-by-${group}`, ['period_or_product', 'revenue', 'cogs', 'profit', 'margin_percent', 'units_sold', 'orders'],
      report.map(row => [row.label, row.revenue, row.cogs, row.profit, row.margin.toFixed(2), row.units, row.orders]));
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not generate this report.' }, { status: 500 });
  }
}
