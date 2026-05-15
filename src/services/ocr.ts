import { countWords } from "../utils/text";

interface OcrResult {
  text: string;
  wordCount: number;
}

export async function ocrPdfPage(fileData: ArrayBuffer, pageNumber: number): Promise<OcrResult> {
  const canvas = await renderPdfPageToCanvas(fileData, pageNumber);
  cropCanvasToReadableContent(canvas);

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        console.info(`OCR ${Math.round((message.progress ?? 0) * 100)}%`);
      }
    }
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: PSM.AUTO
    });
    const {
      data: { text }
    } = await worker.recognize(canvas);
    const normalizedText = normalizeOcrText(text);

    if (normalizedText.length < 120) {
      throw new Error("OCR did not find enough readable text on this page. Try the full-page view or a cleaner PDF.");
    }

    return {
      text: normalizedText,
      wordCount: countWords(normalizedText)
    };
  } finally {
    await worker.terminate();
  }
}

async function renderPdfPageToCanvas(fileData: ArrayBuffer, pageNumber: number): Promise<HTMLCanvasElement> {
  const [pdfjsLib, pdfWorker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileData.slice(0)) }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 3 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("This browser could not prepare the PDF page for OCR.");
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function cropCanvasToReadableContent(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context || canvas.width < 40 || canvas.height < 40) {
    return;
  }

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = findInkBounds(image.data, canvas.width, canvas.height);

  if (!bounds) {
    return;
  }

  const padding = Math.max(28, Math.round(Math.min(canvas.width, canvas.height) * 0.025));
  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(canvas.width, bounds.right + padding);
  const bottom = Math.min(canvas.height, bounds.bottom + padding);
  const width = right - left;
  const height = bottom - top;

  if (width < canvas.width * 0.2 || height < canvas.height * 0.12) {
    return;
  }

  const cropped = context.getImageData(left, top, width, height);
  canvas.width = width;
  canvas.height = height;
  context.putImageData(cropped, 0, 0);
}

function findInkBounds(data: Uint8ClampedArray, width: number, height: number) {
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];

      if (alpha > 8 && (red < 238 || green < 238 || blue < 238) && Math.min(red, green, blue) < 210) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (left > right || top > bottom) {
    return null;
  }

  return { left, right, top, bottom };
}
