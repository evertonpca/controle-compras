import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const target = path.resolve('public/ocr');
await mkdir(path.join(target, 'core'), { recursive: true });
await mkdir(path.join(target, 'lang'), { recursive: true });
const tesseract = path.dirname(require.resolve('tesseract.js/package.json'));
const core = path.dirname(require.resolve('tesseract.js-core/package.json'));
const language = path.dirname(require.resolve('@tesseract.js-data/por/package.json'));
await copyFile(path.join(tesseract, 'dist/worker.min.js'), path.join(target, 'worker.min.js'));
for (const filename of await readdir(core)) {
  if (/\.wasm(?:\.js)?$/.test(filename)) await copyFile(path.join(core, filename), path.join(target, 'core', filename));
}
await copyFile(path.join(language, '4.0.0_best_int/por.traineddata.gz'), path.join(target, 'lang/por.traineddata.gz'));
await copyFile(path.join(tesseract, 'LICENSE.md'), path.join(target, 'LICENSE-tesseract.txt'));
await copyFile(path.join(core, 'LICENSE'), path.join(target, 'LICENSE-core.txt'));
console.log('Arquivos do OCR em portugues preparados em public/ocr.');
