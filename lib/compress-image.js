const MAX_WIDTH = 1000;
const TARGET_BYTES = 200 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(source); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error(`Could not read ${file.name}.`)); };
    image.src = source;
  });
}

function toWebp(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
}

export async function compressProductImage(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    throw new Error('Choose a valid image file.');
  }
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_WIDTH / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot process product images.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
    const blob = await toWebp(canvas, quality);
    if (!blob) throw new Error(`Could not compress ${file.name}.`);
    if (blob.size <= TARGET_BYTES) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
    }
  }
  throw new Error(`${file.name} could not be compressed below 200 KB. Choose a smaller image.`);
}

export async function compressProductImages(files) {
  if (files.length > 6) throw new Error('Choose up to six photos per product.');
  return Promise.all(files.map(compressProductImage));
}
