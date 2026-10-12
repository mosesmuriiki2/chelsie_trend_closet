import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const db = sb();
  if (params.get('categories') === '1') {
    const { data, error } = await db.from('products').select('category').order('category');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json([...new Set(data.map(product => product.category).filter(Boolean))]);
  }

  const cols = isAdmin(req) ? '*' : 'id,name,price,description,sizes,image_url,stock,category,is_featured';
  let query = db.from('products').select(cols);
  if (params.get('featured') === '1') query = query.eq('is_featured', true);
  const category = params.get('category')?.trim();
  const search = params.get('q')?.trim().slice(0, 100);
  const sort = params.get('sort') || 'newest';
  if (category && category.length <= 50) query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);
  if (sort === 'price-asc') query = query.order('price', { ascending: true });
  else if (sort === 'price-desc') query = query.order('price', { ascending: false });
  else if (sort === 'name') query = query.order('name', { ascending: true });
  else if (sort === 'popular') query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const f = await req.formData();
  const db = sb();
  const name = String(f.get('name') || '').trim();
  const price = Number(f.get('price'));
  const buyingPrice = Number(f.get('buying_price') || 0);
  const stock = Number(f.get('stock') || 0);
  const category = String(f.get('category') || 'Uncategorized').trim().slice(0, 50) || 'Uncategorized';
  if (!name || name.length > 120 || !Number.isFinite(price) || price < 0 ||
      !Number.isFinite(buyingPrice) || buyingPrice < 0 || !Number.isInteger(stock) || stock < 0) {
    return NextResponse.json({ error: 'Enter a product name, valid prices, and a whole-number stock quantity.' }, { status: 400 });
  }
  let image_url = null;
  const file = f.get('image');
  if (file && file.size) {
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Product images must be an image file smaller than 5 MB.' }, { status: 400 });
    }
    const path = `${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`;
    const up = await db.storage.from('products').upload(path, file, { contentType: file.type });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    image_url = db.storage.from('products').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await db.from('products').insert({
    name, price, buying_price: buyingPrice, stock,
    category, is_featured: f.get('is_featured') === 'on',
    description: String(f.get('description') || '').trim().slice(0, 1000),
    sizes: String(f.get('sizes') || '').trim().slice(0, 100), image_url,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
