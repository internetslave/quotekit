import { useEffect, useRef, useState } from "react";
import type { Book } from "../types";

interface PdfPageCanvasProps {
  book: Book;
  pageNumber: number;
  viewMode: "crop" | "full";
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export function PdfPageCanvas({ book, pageNumber, viewMode }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Rendering PDF page...");
  const [zoom, setZoom] = useState(1);
  const pinchStateRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (!canvas || !frame) {
        return;
      }

      try {
        setStatus("Rendering PDF page...");
        const [pdfjsLib, pdfWorker] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(book.fileData.slice(0)) }).promise;
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(260, frame.clientWidth - 24);
        const fitScale = availableWidth / baseViewport.width;
        const scale = viewMode === "crop" ? Math.min(3, Math.max(1.75, fitScale * 2.3)) : Math.min(2, fitScale);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");

        if (!context || cancelled) {
          return;
        }

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        context.save();
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();

        await page.render({ canvas, canvasContext: context, viewport }).promise;

        if (cancelled) {
          return;
        }

        if (viewMode === "crop") {
          cropCanvasToReadableContent(canvas, availableWidth);
        } else {
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
        }

        if (!cancelled) {
          setStatus("");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setStatus("This PDF page could not be rendered.");
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [book.fileData, pageNumber, viewMode]);

  // Reset zoom whenever the rendered page or view mode changes — a new page
  // wants its own fit, not a leftover zoom from the previous one.
  useEffect(() => {
    setZoom(1);
  }, [pageNumber, viewMode]);

  function onTouchStart(event: React.TouchEvent) {
    if (event.touches.length === 2) {
      const dist = touchDistance(event.touches[0], event.touches[1]);
      pinchStateRef.current = { startDist: dist, startZoom: zoom };
    } else if (event.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // Double-tap toggle: zoom in to 1.8 or back to 1
        setZoom((current) => (current > 1.1 ? 1 : 1.8));
      }
      lastTapRef.current = now;
    }
  }

  function onTouchMove(event: React.TouchEvent) {
    const state = pinchStateRef.current;
    if (state && event.touches.length === 2) {
      event.preventDefault();
      const dist = touchDistance(event.touches[0], event.touches[1]);
      const next = clamp(state.startZoom * (dist / state.startDist), MIN_ZOOM, MAX_ZOOM);
      setZoom(next);
    }
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (event.touches.length < 2) {
      pinchStateRef.current = null;
    }
  }

  return (
    <div className={`pdf-frame pdf-frame-${viewMode}`} ref={frameRef}>
      {status ? <p className="pdf-status">{status}</p> : null}
      <div
        className="pdf-zoom-wrapper"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />
      </div>
      {zoom !== 1 ? (
        <button
          type="button"
          className="pdf-zoom-reset"
          onClick={() => setZoom(1)}
          aria-label="Reset PDF zoom"
        >
          {(zoom * 100).toFixed(0)}% · reset
        </button>
      ) : null}
    </div>
  );
}

function touchDistance(a: React.Touch, b: React.Touch): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cropCanvasToReadableContent(canvas: HTMLCanvasElement, availableWidth: number) {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context || canvas.width < 40 || canvas.height < 40) {
    return;
  }

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = findInkBounds(image.data, canvas.width, canvas.height);

  if (!bounds) {
    canvas.style.width = `${Math.min(canvas.width, availableWidth)}px`;
    canvas.style.height = "auto";
    return;
  }

  const padding = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.025));
  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(canvas.width, bounds.right + padding);
  const bottom = Math.min(canvas.height, bounds.bottom + padding);
  const width = right - left;
  const height = bottom - top;

  if (width < canvas.width * 0.2 || height < canvas.height * 0.12) {
    canvas.style.width = `${Math.min(canvas.width, availableWidth)}px`;
    canvas.style.height = "auto";
    return;
  }

  const cropped = context.getImageData(left, top, width, height);
  canvas.width = width;
  canvas.height = height;
  context.putImageData(cropped, 0, 0);
  canvas.style.width = `${availableWidth}px`;
  canvas.style.height = `${Math.round((height / width) * availableWidth)}px`;
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
