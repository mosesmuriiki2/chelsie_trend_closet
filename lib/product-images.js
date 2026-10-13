import { randomUUID } from 'node:crypto';

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 200 * 1024;

export async function uploadProductImages(db, files) {
  const selected = files.filter(file => file && file.size > 0);
  if (selected.length > MAX_IMAGES) throw new Error('Upload up to six product images.');
  const urls = [];

  for (const file of selected) {
    if (file.type !== 'image/webp' || file.size > MAX_IMAGE_BYTES) {
      await removeProductImages(db, urls);
      throw new Error('Product photos must be compressed WebP images under 200 KB each. Please choose them again.');
    }
    const path = `${randomUUID()}.webp`;
    const result = await db.storage.from('products').upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: 'image/webp',
      upsert: false,
    });
    if (result.error) {
      await removeProductImages(db, urls);
      throw new Error(`Could not upload a product photo: ${result.error.message}`);
    }
    urls.push(db.storage.from('products').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

export function productImagePath(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/public/products/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export async function removeProductImages(db, urls) {
  const paths = [...new Set((urls || []).map(productImagePath).filter(Boolean))];
  if (!paths.length) return;
  const { error } = await db.storage.from('products').remove(paths);
  if (error) throw new Error(`Could not remove old product photos: ${error.message}`);
}

export { MAX_IMAGES, MAX_IMAGE_BYTES };
