import type { Worker } from 'tesseract.js';

// OCR assets are copied from installed packages and served by this application.
export async function readReceiptPhoto(file: File, signal: AbortSignal, onProgress: (message: string) => void): Promise<string> {
  if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) throw new Error('Use uma foto JPG, PNG ou WebP. Se necessario, converta a foto HEIC do celular para JPG.');
  if (file.size > 20 * 1024 * 1024) throw new Error('A foto deve ter no maximo 20 MB.');
  let worker: Worker | undefined;
  const abort = () => { void worker?.terminate().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    onProgress('Preparando leitura da foto...');
    const { createWorker, PSM } = await import('tesseract.js');
    signal.throwIfAborted();
    worker = await createWorker('por', 1, {
      workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang',
      workerBlobURL: false,
      logger: ({ status, progress }) => {
        if (signal.aborted) return;
        onProgress(status === 'recognizing text' ? `Lendo nota: ${Math.round(progress * 100)}%` : 'Carregando leitor gratuito...');
      }
    });
    signal.throwIfAborted();
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(file, { rotateAuto: true });
    signal.throwIfAborted();
    if (data.confidence < 60) onProgress('Foto com baixa nitidez. Confira o texto reconhecido.');
    return data.text;
  } finally {
    signal.removeEventListener('abort', abort);
    await worker?.terminate().catch(() => undefined);
  }
}
