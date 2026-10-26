import { describe, expect, it } from 'vitest';
import { enhanceReceiptContrast } from '../../src/client/services/receiptImage.js';

describe('preparacao da foto da nota', () => {
  it('clareia papel sob sombras diferentes e preserva o texto escuro', () => {
    const width = 192;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const background = x < 96 ? 100 : 220;
      const isLetter = y >= 25 && y <= 35 && (x <= 4 || x >= 187);
      const value = isLetter ? background * 0.2 : background;
      const index = (y * width + x) * 4;
      data.set([value, value, value, 255], index);
    }
    enhanceReceiptContrast(data, width, height);
    const pixel = (x: number, y: number) => data[(y * width + x) * 4];
    expect(pixel(0, 0)).toBeGreaterThan(240);
    expect(pixel(191, 0)).toBeGreaterThan(240);
    expect(pixel(0, 30)).toBeLessThan(50);
    expect(pixel(191, 30)).toBeLessThan(50);
  });
});
