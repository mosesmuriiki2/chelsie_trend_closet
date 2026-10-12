import { NextResponse } from 'next/server';
import { sb, isAdmin } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  // buying_price is only returned to the admin
  const cols = isAdmin(req) ? '*' : 'id,name,price,description,sizes,image_url,stock';
  const { data, error } = await sb().from('products').select(cols).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const f = await req.formData();
  const db = sb();
  let image_url = null;
  const file = f.get('image');
  if (file && file.size) {
    const path = `${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`;
    const up = await db.storage.from('products').upload(path, file, { contentType: file.type });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    image_url = db.storage.from('products').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await db.from('products').insert({
    name: f.get('name'), price: Number(f.get('price')),
    buying_price: Number(f.get('buying_price') || 0), stock: parseInt(f.get('stock') || 0),
    description: f.get('description'), sizes: f.get('sizes'), image_url,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
