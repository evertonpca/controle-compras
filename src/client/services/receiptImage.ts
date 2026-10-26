export interface ReceiptCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const fullReceipt: ReceiptCrop = { left: 0, top: 0, right: 100, bottom: 100 };

// Estimate the paper brightness locally instead of using a single threshold:
// folds and shadows must not become large black areas that obscure the text.
export function enhanceReceiptContrast(pixels: Uint8ClampedArray, width: number, height: number): void {
  const size = 64;
  const columns = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const backgrounds = new Float32Array(columns * rows);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < columns; bx++) {
      const histogram = new Uint32Array(256);
      let count = 0;
      for (let y = by * size; y < Math.min(height, (by + 1) * size); y++) {
        for (let x = bx * size; x < Math.min(width, (bx + 1) * size); x++) {
          const offset = (y * width + x) * 4;
          const gray = Math.round(pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114);
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = gray;
          histogram[gray]++;
          count++;
        }
      }
      let accumulated = 0;
      let background = 255;
      while (background > 0 && accumulated < count * 0.2) accumulated += histogram[background--];
      backgrounds[by * columns + bx] = Math.max(60, background + 1);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = Math.max(0, x / size - 0.5);
      const gy = Math.max(0, y / size - 0.5);
      const x0 = Math.min(columns - 1, Math.floor(gx));
      const y0 = Math.min(rows - 1, Math.floor(gy));
      const x1 = Math.min(columns - 1, x0 + 1);
      const y1 = Math.min(rows - 1, y0 + 1);
      const fx = gx - x0;
      const fy = gy - y0;
      const top = backgrounds[y0 * columns + x0] * (1 - fx) + backgrounds[y0 * columns + x1] * fx;
      const bottom = backgrounds[y1 * columns + x0] * (1 - fx) + backgrounds[y1 * columns + x1] * fx;
      const background = top * (1 - fy) + bottom * fy;
      const offset = (y * width + x) * 4;
      const corrected = Math.max(0, Math.min(255, (pixels[offset] / background * 255 - 128) * 1.35 + 128));
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = corrected;
      pixels[offset + 3] = 255;
    }
  }
}

export async function prepareReceiptImage(file: File, crop: ReceiptCrop, signal: AbortSignal): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    const left = Math.max(0, Math.min(99, crop.left));
    const top = Math.max(0, Math.min(99, crop.top));
    const right = Math.max(left + 1, Math.min(100, crop.right));
    const bottom = Math.max(top + 1, Math.min(100, crop.bottom));
    const width = image.naturalWidth * (right - left) / 100;
    const height = image.naturalHeight * (bottom - top) / 100;
    // Enlarge small receipt text, but limit memory use on phones.
    const scale = Math.min(3, Math.max(1, 1800 / width), Math.sqrt(5_000_000 / (width * height)), 5000 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Nao foi possivel preparar a foto neste navegador.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, image.naturalWidth * left / 100, image.naturalHeight * top / 100, width, height, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    enhanceReceiptContrast(imageData.data, canvas.width, canvas.height);
    context.putImageData(imageData, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
