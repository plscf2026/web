const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 6000;
const MAX_IMAGE_PIXELS = 20_000_000;

export async function readValidatedImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image files must be smaller than 5 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('The selected file is not a valid image.');
  }

  const imageIsTooLarge =
    bitmap.width > MAX_IMAGE_DIMENSION ||
    bitmap.height > MAX_IMAGE_DIMENSION ||
    bitmap.width * bitmap.height > MAX_IMAGE_PIXELS;
  bitmap.close();
  if (imageIsTooLarge) {
    throw new Error('Image dimensions must not exceed 6000 pixels or 20 megapixels.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read the selected image.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
