import { NextResponse } from 'next/server';
import { isAdmin, sb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Sign in to view product insights.' }, { status: 401 });
  const db = sb();
  const [{ data: products, error: productError }, { data: terms, error: termsError }] = await Promise.all([
    db.from('products').select('id,name,category,stock,price,buying_price').eq('is_visible', true).limit(500),
    db.from('trending_keywords').select('id,keyword,link_url').eq('is_active', true).order('created_at', { ascending: false }).limit(50),
  ]);
  if (productError || termsError) return NextResponse.json({ error: productError?.message || termsError?.message }, { status: 500 });
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const { data: sales, error: salesError } = await db.from('sales')
    .select('product_id,qty,selling_price,created_at').gte('created_at', since.toISOString()).order('created_at', { ascending: true }).limit(5000);
  if (salesError) return NextResponse.json({ error: salesError.message }, { status: 500 });

  const insights = products.map(product => {
    const productSales = sales.filter(sale => sale.product_id === product.id);
    const daily = Array(30).fill(0);
    const weekdays = Array(7).fill(0);
    const today = new Date();
    let daysWithSales = 0;
    for (const sale of productSales) {
      const soldAt = new Date(sale.created_at);
      weekdays[soldAt.getDay()] += Number(sale.qty);
      const age = Math.floor((today - soldAt) / 86400000);
      if (age < 30 && age >= 0) daily[29 - age] += Number(sale.qty);
    }
    daysWithSales = daily.filter(quantity => quantity > 0).length;
    const average = daily.reduce((sum, quantity) => sum + quantity, 0) / daily.length;
    let smoothed = daily[0];
    for (const quantity of daily.slice(1)) smoothed = 0.3 * quantity + 0.7 * smoothed;
    const trend = daily.length > 1 ? (daily.at(-1) - daily[0]) / (daily.length - 1) : 0;
    const demandPerDay = Math.max(0, average * 0.55 + smoothed * 0.3 + Math.max(-average * 0.2, trend) * 0.15);
    const forecast = days => Math.round(demandPerDay * days * 10) / 10;
    const daysOfStock = demandPerDay > 0 ? Math.round(Number(product.stock || 0) / demandPerDay) : null;
    const weekdayPeak = weekdays.indexOf(Math.max(...weekdays));
    const pricedSales = productSales.filter(sale => Number(sale.selling_price) > 0);
    let priceHint = 'Not enough price history to compare demand.';
    if (pricedSales.length >= 8 && new Set(pricedSales.map(sale => Number(sale.selling_price))).size >= 2) {
      const meanPrice = pricedSales.reduce((sum, sale) => sum + Number(sale.selling_price), 0) / pricedSales.length;
      const meanQuantity = pricedSales.reduce((sum, sale) => sum + Number(sale.qty), 0) / pricedSales.length;
      const covariance = pricedSales.reduce((sum, sale) =>
        sum + (Number(sale.selling_price) - meanPrice) * (Number(sale.qty) - meanQuantity), 0);
      const priceVariance = pricedSales.reduce((sum, sale) => sum + (Number(sale.selling_price) - meanPrice) ** 2, 0);
      const quantityVariance = pricedSales.reduce((sum, sale) => sum + (Number(sale.qty) - meanQuantity) ** 2, 0);
      const correlation = priceVariance && quantityVariance
        ? covariance / Math.sqrt(priceVariance * quantityVariance) : 0;
      priceHint = Math.abs(correlation) < 0.25
        ? 'Recorded sales show little price/quantity association.'
        : `Recorded sales show ${correlation < 0 ? 'lower prices with higher quantities' : 'higher prices with higher quantities'}; this is an association, not a cause.`;
    }
    return {
      ...product,
      forecast_7_days: forecast(7),
      forecast_14_days: forecast(14),
      forecast_30_days: forecast(30),
      daily_demand: Math.round(demandPerDay * 100) / 100,
      confidence: daysWithSales < 14 ? 'low data' : 'based on recent sales',
      days_of_stock: daysOfStock,
      suggested_reorder: Math.max(0, Math.ceil(demandPerDay * 30 - Number(product.stock || 0))),
      weekday_hint: weekdays[weekdayPeak] > 0 ? new Date(2024, 0, 7 + weekdayPeak).toLocaleDateString('en', { weekday: 'long' }) : null,
      actual_last_7: daily.slice(-7),
      price_hint: priceHint,
    };
  });
  const deadStock = insights.filter(product => Number(product.stock || 0) > 0 &&
    !sales.some(sale => sale.product_id === product.id &&
      (Date.now() - new Date(sale.created_at).getTime()) >= 0 &&
      (Date.now() - new Date(sale.created_at).getTime()) < 30 * 86400000));
  const trending = terms.map(term => ({
    ...term,
    matches: products.filter(product =>
      `${product.name} ${product.category || ''}`.toLowerCase().includes(term.keyword.toLowerCase()))
      .map(product => ({ id: product.id, name: product.name, category: product.category })),
  }));
  return NextResponse.json({
    products: insights.sort((a, b) => b.forecast_30_days - a.forecast_30_days),
    dead_stock: deadStock.map(product => ({
      id: product.id, name: product.name, stock: product.stock,
      value_at_cost: Number(product.stock || 0) * Number(product.buying_price || 0),
    })),
    trending,
    explanation: 'Forecasts blend the recent 30-day average, exponential smoothing, and a small trend adjustment. They are planning estimates, not guarantees.',
  });
}
