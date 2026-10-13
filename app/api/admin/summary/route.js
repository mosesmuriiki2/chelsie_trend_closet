import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function sumRows(db, table, columns, from, to) {
  const rows = [];
  for (let start = 0; start < 20000; start += 1000) {
    let query = db.from(table).select(columns).order('created_at', { ascending: true }).range(start, start + 999);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view store performance.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const range = params.get('range') || '30d';
  if (!['today', '7d', '30d', '90d', 'custom'].includes(range)) {
    return NextResponse.json({ error: 'Choose a supported dashboard date range.' }, { status: 400 });
  }
  const now = new Date();
  let from = null;
  let to = null;
  if (range === 'today') {
    from = new Date(now); from.setHours(0, 0, 0, 0);
  } else if (['7d', '30d', '90d'].includes(range)) {
    from = new Date(now); from.setDate(from.getDate() - Number.parseInt(range, 10));
  } else if (range === 'custom') {
    from = params.get('from') && new Date(params.get('from'));
    to = params.get('to') && new Date(`${params.get('to')}T23:59:59.999`);
    if ((from && Number.isNaN(from.valueOf())) || (to && Number.isNaN(to.valueOf())) || (from && to && from > to)) {
      return NextResponse.json({ error: 'Choose a valid date range.' }, { status: 400 });
    }
  }
  try {
    const db = sb();
    const start = from?.toISOString();
    const end = to?.toISOString();
    const [sales, orders, expenses] = await Promise.all([
      sumRows(db, 'sales', 'qty,selling_price,buying_price,created_at', start, end),
      sumRows(db, 'orders', 'total,status,created_at', start, end),
      sumRows(db, 'expenses', 'amount,created_at', start, end),
    ]);
    const products = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
      const { data, error } = await db.from('products')
        .select('id,name,stock,buying_price,price')
        .order('name').range(offset, offset + 999);
      if (error) throw new Error(error.message);
      products.push(...data);
      if (data.length < 1000) break;
    }
    const { data: settings, error: settingsError } = await db.from('settings')
      .select('low_stock_threshold').eq('id', true).single();
    if (settingsError) throw new Error(settingsError.message);
    const revenue = sales.reduce((total, sale) => total + Number(sale.qty) * Number(sale.selling_price), 0);
    const cogs = sales.reduce((total, sale) => total + Number(sale.qty) * Number(sale.buying_price), 0);
    const expenseTotal = expenses.reduce((total, expense) => total + Number(expense.amount), 0);
    const completedOrders = orders.filter(order => order.status !== 'cancelled');
    const orderValue = completedOrders.reduce((total, order) => total + Number(order.total || 0), 0);
    const topProducts = new Map();
    for (const sale of sales) {
      const row = topProducts.get(sale.product_name) || { name: sale.product_name, units: 0, profit: 0 };
      row.units += Number(sale.qty);
      row.profit += Number(sale.qty) * (Number(sale.selling_price) - Number(sale.buying_price));
      topProducts.set(sale.product_name, row);
    }
    const spanStart = from || new Date(now.getTime() - 29 * 86400000);
    const spanEnd = to || now;
    const dayCount = Math.max(1, Math.min(366, Math.floor((spanEnd - spanStart) / 86400000) + 1));
    const weekly = dayCount > 31;
    const periodKey = date => {
      const day = new Date(date);
      if (!weekly) return day.toISOString().slice(0, 10);
      day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
      return day.toISOString().slice(0, 10);
    };
    const trendMap = new Map();
    for (let index = 0; index < dayCount; index += 1) {
      const day = new Date(spanStart);
      day.setDate(day.getDate() + index);
      const key = periodKey(day);
      if (!trendMap.has(key)) trendMap.set(key, { label: key, revenue: 0, cogs: 0, expenses: 0 });
    }
    for (const sale of sales) {
      const row = trendMap.get(periodKey(sale.created_at));
      if (!row) continue;
      row.revenue += Number(sale.qty) * Number(sale.selling_price);
      row.cogs += Number(sale.qty) * Number(sale.buying_price);
    }
    for (const expense of expenses) {
      const row = trendMap.get(periodKey(expense.created_at));
      if (row) row.expenses += Number(expense.amount);
    }
    const trend = [...trendMap.values()].sort((a, b) => a.label.localeCompare(b.label))
      .map(row => ({ ...row, profit: row.revenue - row.cogs - row.expenses }));
    const lowStockThreshold = Number(settings.low_stock_threshold ?? 3);
    return NextResponse.json({
      revenue, cogs, profit: revenue - cogs - expenseTotal, expenses: expenseTotal,
      margin: revenue ? (revenue - cogs - expenseTotal) / revenue * 100 : 0,
      units: sales.reduce((total, sale) => total + Number(sale.qty), 0),
      orders: completedOrders.length,
      average_order_value: completedOrders.length ? orderValue / completedOrders.length : 0,
      stock_cost: products.reduce((total, product) => total + Number(product.stock || 0) * Number(product.buying_price || 0), 0),
      stock_retail: products.reduce((total, product) => total + Number(product.stock || 0) * Number(product.price || 0), 0),
      low_stock_products: products.filter(product => Number(product.stock || 0) <= lowStockThreshold),
      trend,
      top_products: [...topProducts.values()].sort((a, b) => b.profit - a.profit).slice(0, 5),
      order_funnel: ['new', 'confirmed', 'paid', 'delivered', 'cancelled'].reduce((result, status) => {
        result[status] = orders.filter(order => order.status === status).length;
        return result;
      }, {}),
      range,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not calculate the dashboard summary.' }, { status: 500 });
  }
}
