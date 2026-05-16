import JSZip from "jszip";
import type { Book, Chapter, ImportResult } from "../types";
import { createId } from "../utils/id";
import { countWords } from "../utils/text";

const COVER_COLORS = ["#d8895f", "#8aa68a", "#6e9bbf", "#c49a4f", "#a77fbd"];

export async function ingestFile(file: File): Promise<ImportResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".epub") || file.type.includes("epub")) {
    return ingestEpub(file);
  }

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    return ingestPdf(file);
  }

  throw new Error("ReadingMadeFun currently supports EPUB and PDF files.");
}

async function ingestPdf(file: File): Promise<ImportResult> {
  const id = createId("book");
  const fileData = await file.arrayBuffer();
  const [pdfjsLib, pdfWorker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileData.slice(0)) }).promise;
  const chapters: Chapter[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const text = await extractPdfPageText(page);

    chapters.push({
      id: `${id}_page_${pageNumber}`,
      bookId: id,
      index: pageNumber - 1,
      title: `Page ${pageNumber}`,
      text: text || `PDF page ${pageNumber}`,
      wordCount: countWords(text),
      pageNumber
    });
  }

  const title = file.name.replace(/\.pdf$/i, "");
  const book = createBook({
    id,
    title,
    author: "Unknown author",
    format: "pdf",
    file,
    fileData,
    chapters
  });

  return {
    book,
    warning:
      "PDFs are rendered page-by-page. If a scanned PDF or mobile browser cannot expose text, AI summaries may need OCR in a future version."
  };
}

async function extractPdfPageText(page: { getTextContent: () => Promise<{ items: unknown[] }> }): Promise<string> {
  try {
    const content = await page.getTextContent();
    return content.items
      .map((item) => (item && typeof item === "object" && "str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (error) {
    console.warn("PDF text extraction failed for one page; rendering will still work.", error);
    return "";
  }
}

async function ingestEpub(file: File): Promise<ImportResult> {
  const id = createId("book");
  const fileData = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(fileData.slice(0));
  const container = await zip.file("META-INF/container.xml")?.async("text");

  if (!container) {
    throw new Error("This EPUB is missing its container metadata.");
  }

  const containerDoc = parseXml(container);
  const rootfile = getFirstElement(containerDoc, "rootfile")?.getAttribute("full-path");

  if (!rootfile) {
    throw new Error("This EPUB does not point to a package document.");
  }

  const packageText = await zip.file(rootfile)?.async("text");
  if (!packageText) {
    throw new Error("This EPUB package document could not be read.");
  }

  const packageDoc = parseXml(packageText);
  const packageDir = rootfile.includes("/") ? rootfile.split("/").slice(0, -1).join("/") : "";
  const title = getTextContent(packageDoc, "title") || file.name.replace(/\.epub$/i, "");
  const author = getTextContent(packageDoc, "creator") || "Unknown author";
  const manifest = new Map<string, string>();

  for (const item of getElements(packageDoc, "item")) {
    const itemId = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";

    if (itemId && href && (mediaType.includes("xhtml") || mediaType.includes("html"))) {
      manifest.set(itemId, normalizeZipPath(packageDir, href));
    }
  }

  const chapters: Chapter[] = [];
  const spineItems = getElements(packageDoc, "itemref");

  for (const itemRef of spineItems) {
    const idRef = itemRef.getAttribute("idref");
    const href = idRef ? manifest.get(idRef) : undefined;

    if (!href) {
      continue;
    }

    const chapterText = await zip.file(href)?.async("text");
    if (!chapterText) {
      continue;
    }

    const chapterDoc = new DOMParser().parseFromString(chapterText, "text/html");
    chapterDoc.querySelectorAll("script, style, nav, aside").forEach((node) => node.remove());
    // Prefer real in-body headings (h1..h3) over <title>, which on Project
    // Gutenberg EPUBs is the book title and would make every chapter render
    // identical. Skip headings that just echo the book title.
    const headingCandidates = Array.from(
      chapterDoc.querySelectorAll<HTMLElement>("h1, h2, h3")
    )
      .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter((text) => text.length > 0 && text.length <= 120)
      .filter((text) => text.toLowerCase() !== title.toLowerCase());
    const titleFallback = chapterDoc
      .querySelector("title")
      ?.textContent?.replace(/\s+/g, " ").trim();
    const heading =
      headingCandidates[0] ||
      (titleFallback && titleFallback.toLowerCase() !== title.toLowerCase()
        ? titleFallback
        : "") ||
      `Chapter ${chapters.length + 1}`;
    const text = extractReadableHtmlText(chapterDoc, heading);

    if (text.length < 40) {
      continue;
    }

    chapters.push({
      id: `${id}_chapter_${chapters.length + 1}`,
      bookId: id,
      index: chapters.length,
      title: heading,
      text,
      wordCount: countWords(text)
    });
  }

  if (chapters.length === 0) {
    throw new Error("No readable chapters were found in this EPUB.");
  }

  return {
    book: createBook({
      id,
      title,
      author,
      format: "epub",
      file,
      fileData,
      chapters
    })
  };
}

function createBook(input: {
  id: string;
  title: string;
  author: string;
  format: "epub" | "pdf";
  file: File;
  fileData: ArrayBuffer;
  chapters: Chapter[];
}): Book {
  const now = new Date().toISOString();

  return {
    id: input.id,
    title: input.title,
    author: input.author,
    format: input.format,
    fileName: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
    fileData: input.fileData,
    chapters: input.chapters,
    totalWords: input.chapters.reduce((total, chapter) => total + chapter.wordCount, 0),
    coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
    createdAt: now,
    updatedAt: now
  };
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function getElements(doc: Document, tagName: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS("*", tagName));
}

function getFirstElement(doc: Document, tagName: string): Element | undefined {
  return getElements(doc, tagName)[0];
}

function getTextContent(doc: Document, tagName: string): string {
  return getFirstElement(doc, tagName)?.textContent?.trim() ?? "";
}

function normalizeZipPath(baseDir: string, href: string): string {
  const parts = `${baseDir ? `${baseDir}/` : ""}${decodeURIComponent(href)}`
    .split("/")
    .filter((part) => part && part !== ".");
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }

  return normalized.join("/");
}

function extractReadableHtmlText(doc: Document, heading: string): string {
  const blockSelectors = "h1, h2, h3, h4, p, li, blockquote";
  const blocks = Array.from(doc.body.querySelectorAll(blockSelectors))
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean);
  const withoutDuplicateHeading =
    blocks[0]?.toLowerCase() === heading.toLowerCase() ? blocks.slice(1) : blocks;

  if (withoutDuplicateHeading.length > 0) {
    return withoutDuplicateHeading.join("\n\n");
  }

  return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
