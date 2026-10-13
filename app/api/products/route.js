import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
import { MAX_IMAGES, removeProductImages, uploadProductImages } from '@/lib/product-images';
export const dynamic = 'force-dynamic';
const PUBLIC_COLUMNS = 'id,name,name_sw,price,compare_at_price,description,description_sw,sizes,colours,images,image_url,stock,category,category_id,is_featured,sku,created_at';

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const db = sb();
  if (params.get('categories') === '1') {
    const { data, error } = await db.from('categories').select('id,name,slug,image_url,sort_order').eq('is_visible', true).order('sort_order').limit(50);
    if (!error && data.length) {
      const response = NextResponse.json(data);
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return response;
    }
    const legacy = await db.from('products').select('category').eq('is_visible', true).order('category').limit(500);
    if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 });
    const response = NextResponse.json([...new Set(legacy.data.map(product => product.category).filter(Boolean))]);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  }

  const admin = isAdmin(req);
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(48, Number.parseInt(params.get('limit') || '24', 10) || 24));
  let query = db.from('products').select(admin ? '*' : PUBLIC_COLUMNS, { count: 'exact' });
  if (!admin || params.get('visible') !== 'all') query = query.eq('is_visible', true);
  if (params.get('featured') === '1') query = query.eq('is_featured', true);
  if (params.get('sale') === '1') query = query.not('compare_at_price', 'is', null);
  const category = params.get('category')?.trim();
  const search = params.get('q')?.trim().replace(/[%_,]/g, ' ').slice(0, 80);
  const size = params.get('size')?.trim().replace(/[%_,]/g, ' ').slice(0, 30);
  const minPrice = Number(params.get('minPrice'));
  const maxPrice = Number(params.get('maxPrice'));
  const sort = params.get('sort') || 'newest';
  if (category && category.length <= 50) query = query.eq('category', category);
  if (search) query = query.ilike('name', `%${search}%`);
  if (size) query = query.ilike('sizes', `%${size}%`);
  if (params.has('minPrice') && Number.isFinite(minPrice) && minPrice >= 0) query = query.gte('price', minPrice);
  if (params.has('maxPrice') && Number.isFinite(maxPrice) && maxPrice >= 0) query = query.lte('price', maxPrice);
  if (sort === 'price-asc') query = query.order('price', { ascending: true });
  else if (sort === 'price-desc') query = query.order('price', { ascending: false });
  else if (sort === 'name') query = query.order('name', { ascending: true });
  else if (sort === 'popular') query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const response = NextResponse.json({ products: data, page, pageSize, total: count || 0 });
  response.headers.set('Cache-Control', admin ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300');
  return response;
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
  const compareAtPriceValue = String(f.get('compare_at_price') || '').trim();
  const compareAtPrice = compareAtPriceValue ? Number(compareAtPriceValue) : null;
  if (!name || name.length > 120 || !Number.isFinite(price) || price < 0 ||
      !Number.isFinite(buyingPrice) || buyingPrice < 0 || !Number.isInteger(stock) || stock < 0 ||
      (compareAtPrice != null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= price))) {
    return NextResponse.json({ error: 'Enter a product name, valid prices, and a whole-number stock quantity. Compare-at price must be higher than the selling price.' }, { status: 400 });
  }
  const files = [...f.getAll('images'), ...f.getAll('image')].filter(file => file instanceof File && file.size);
  if (files.length > MAX_IMAGES) return NextResponse.json({ error: 'Upload up to six product images.' }, { status: 400 });
  let images;
  try { images = await uploadProductImages(db, files); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  const image_url = images[0] || null;
  let categoryId = String(f.get('category_id') || '') || null;
  if (!categoryId && category !== 'Uncategorized') {
    const { data: match } = await db.from('categories').select('id').eq('name', category).maybeSingle();
    categoryId = match?.id || null;
  }
  const { error } = await db.from('products').insert({
    name, price, buying_price: buyingPrice, stock,
    category, images, image_url, compare_at_price: compareAtPrice,
    category_id: categoryId,
    sku: String(f.get('sku') || '').trim().slice(0, 60) || null,
    colours: String(f.get('colours') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 20),
    name_sw: String(f.get('name_sw') || '').trim().slice(0, 120) || null,
    description_sw: String(f.get('description_sw') || '').trim().slice(0, 1000) || null,
    is_visible: f.get('is_visible') == null || f.get('is_visible') === 'on',
    is_featured: f.get('is_featured') === 'on',
    description: String(f.get('description') || '').trim().slice(0, 1000),
    sizes: String(f.get('sizes') || '').trim().slice(0, 100),
  });
  if (error) {
    await removeProductImages(db, images);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
