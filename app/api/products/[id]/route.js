import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
import { removeProductImages } from '@/lib/product-images';
const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });

export async function DELETE(req, { params }) {
  if (!isAdmin(req)) return deny();
  const { id } = await params;
  const db = sb();
  const { data: product, error: lookupError } = await db.from('products').select('images,image_url').eq('id', id).single();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 404 });
  const { error } = await db.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await removeProductImages(db, [...(product.images || []), product.image_url]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  if (!isAdmin(req)) return deny();
  const { id } = await params;
  const b = await req.json();
  const db = sb();
  const { data: p, error: lookupError } = await db.from('products').select('stock,images,image_url,price').eq('id', id).single();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 404 });
  const upd = {};
  let restocked = false;
  if (b.price != null) {
    if (!Number.isFinite(Number(b.price)) || Number(b.price) < 0) return NextResponse.json({ error: 'Price must be a non-negative number.' }, { status: 400 });
    upd.price = Number(b.price);
  }
  if (b.buying_price != null) {
    if (!Number.isFinite(Number(b.buying_price)) || Number(b.buying_price) < 0) return NextResponse.json({ error: 'Buying price must be a non-negative number.' }, { status: 400 });
    upd.buying_price = Number(b.buying_price);
  }
  if (b.addStock != null) {
    const amount = Number(b.addStock);
    if (!Number.isInteger(amount) || amount < 1) return NextResponse.json({ error: 'Restock quantity must be a positive whole number.' }, { status: 400 });
    if (b.buying_price != null) {
      const { error } = await db.rpc('restock_product', {
        p_product_id: id,
        p_quantity: amount,
        p_buying_price: upd.buying_price ?? null,
        p_note: String(b.supplier_note || '').slice(0, 300),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: error.message === 'product_not_found' ? 404 : 500 });
      delete upd.buying_price;
      restocked = true;
    } else {
      const { error } = await db.rpc('restock_product', {
        p_product_id: id,
        p_quantity: amount,
        p_buying_price: null,
        p_note: String(b.supplier_note || '').slice(0, 300),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: error.message === 'product_not_found' ? 404 : 500 });
      restocked = true;
    }
  }
  if (b.category != null) {
    const category = String(b.category).trim();
    if (!category || category.length > 50) return NextResponse.json({ error: 'Category must be between 1 and 50 characters.' }, { status: 400 });
    upd.category = category;
    const { data: categoryRow } = await db.from('categories').select('id').eq('name', category).maybeSingle();
    upd.category_id = categoryRow?.id || null;
  }
  if (b.is_featured != null) {
    if (typeof b.is_featured !== 'boolean') return NextResponse.json({ error: 'Popular status must be true or false.' }, { status: 400 });
    upd.is_featured = b.is_featured;
  }
  if (b.is_visible != null) {
    if (typeof b.is_visible !== 'boolean') return NextResponse.json({ error: 'Visibility must be true or false.' }, { status: 400 });
    upd.is_visible = b.is_visible;
  }
  for (const field of ['name', 'name_sw', 'description', 'description_sw', 'sku', 'sizes']) {
    if (b[field] != null) {
      const value = String(b[field]).trim();
      const maxLength = field.startsWith('name') ? 120 : field.startsWith('description') ? 1000 :
        field === 'sku' ? 60 : 100;
      if (value.length > maxLength || (field === 'name' && !value)) {
        return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be ${field === 'name' ? 'non-empty and ' : ''}${maxLength} characters or fewer.` }, { status: 400 });
      }
      upd[field] = value;
    }
  }
  if (b.compare_at_price !== undefined) {
    const value = b.compare_at_price == null || b.compare_at_price === '' ? null : Number(b.compare_at_price);
    if (value != null && (!Number.isFinite(value) || value <= 0 || value <= Number(b.price ?? p.price))) {
      return NextResponse.json({ error: 'Compare-at price must be higher than the selling price.' }, { status: 400 });
    }
    upd.compare_at_price = value;
  }
  if (b.colours != null) {
    if (!Array.isArray(b.colours) || b.colours.length > 20 || b.colours.some(value => typeof value !== 'string' || value.length > 40)) {
      return NextResponse.json({ error: 'Provide up to 20 valid colour names.' }, { status: 400 });
    }
    upd.colours = b.colours.map(value => value.trim()).filter(Boolean);
  }
  if (b.images != null) {
    if (!Array.isArray(b.images) || b.images.length > 6 || b.images.some(url =>
      typeof url !== 'string' || url.length > 2048 ||
      !(url.startsWith('https://') || (url.startsWith('/') && !url.startsWith('//'))))) {
      return NextResponse.json({ error: 'A product may have up to six valid image links.' }, { status: 400 });
    }
    upd.images = b.images;
    upd.image_url = b.images[0] || null;
  }
  if (b.category_id !== undefined) upd.category_id = b.category_id || null;
  if (!Object.keys(upd).length && !restocked) return NextResponse.json({ error: 'No valid product changes were provided.' }, { status: 400 });
  if (Object.keys(upd).length) {
    const { error } = await db.from('products').update(upd).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (upd.images) {
    const retained = new Set(upd.images);
    await removeProductImages(db, [...(p.images || []), p.image_url].filter(url => url && !retained.has(url)));
  }
  return NextResponse.json({ ok: true });
}
