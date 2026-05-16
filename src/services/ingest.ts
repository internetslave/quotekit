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

    // Some EPUBs (scripture compilations like the Book of Mormon, anthologies,
    // poetry collections) bundle many real chapters inside a single spine
    // item, marked by repeated h1/h2 headings. Try to split first; only fall
    // back to "whole spine item is one chapter" if there isn't enough heading
    // structure to make splitting safe.
    const innerSections = splitDocIntoSections(chapterDoc, title);
    if (innerSections.length > 0) {
      for (const section of innerSections) {
        chapters.push({
          id: `${id}_chapter_${chapters.length + 1}`,
          bookId: id,
          index: chapters.length,
          title: section.title || `Chapter ${chapters.length + 1}`,
          text: section.text,
          wordCount: countWords(section.text)
        });
      }
      continue;
    }

    // Single-section spine item (a normal novel chapter, intro page, etc.):
    // pick the best in-body heading or fall back to the document <title>,
    // skipping anything that just echoes the book title.
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

interface Section {
  title: string;
  text: string;
}

// Split a parsed EPUB spine document into multiple chapter sections if it
// contains 2+ in-body headings that look like real chapter boundaries.
// Returns [] when the document is a single-section file and the caller
// should fall back to its existing single-chapter logic.
function splitDocIntoSections(doc: Document, bookTitle: string): Section[] {
  if (!doc.body) return [];

  // Consider h1/h2/h3 in document order. We deliberately exclude h4+ so we
  // don't shatter on inline scene-break-ish headers inside a chapter.
  const headings = Array.from(doc.body.querySelectorAll<HTMLElement>("h1, h2, h3"));
  if (headings.length < 2) return [];

  // Only split when the dominant heading level is the same across all
  // headings; otherwise the file's heading hierarchy is mixed (e.g. a single
  // h1 with h2 subsection breaks underneath) and we'd produce a confused
  // chapter list. Choose the level with the most occurrences and keep only
  // those headings as section boundaries.
  const levelCounts = new Map<string, number>();
  for (const h of headings) {
    levelCounts.set(h.tagName, (levelCounts.get(h.tagName) ?? 0) + 1);
  }
  let dominant = headings[0].tagName;
  for (const [level, count] of levelCounts) {
    if (count > (levelCounts.get(dominant) ?? 0)) dominant = level;
  }
  const splitPoints = headings.filter((h) => h.tagName === dominant);
  if (splitPoints.length < 2) return [];

  const bookTitleLower = bookTitle.toLowerCase();
  const sections: Section[] = [];

  for (let i = 0; i < splitPoints.length; i++) {
    const startHeading = splitPoints[i];
    const endHeading: HTMLElement | undefined = splitPoints[i + 1];

    let title = startHeading.textContent?.replace(/\s+/g, " ").trim() ?? "";
    // If the heading is just the book title, leave it blank; the caller
    // will substitute a "Chapter N" label so the user sees real progress.
    if (title.toLowerCase() === bookTitleLower) title = "";
    if (title.length > 140) title = title.slice(0, 137) + "...";

    let text = "";
    try {
      const range = doc.createRange();
      range.setStartAfter(startHeading);
      if (endHeading) {
        range.setEndBefore(endHeading);
      } else {
        range.setEndAfter(doc.body);
      }
      text = range.toString().replace(/\s+/g, " ").trim();
    } catch {
      // createRange/Range can throw in older jsdom-style environments. Fall
      // back to walking textContent of following siblings; good enough for
      // EPUBs whose chapters sit as direct body children.
      text = walkSiblingText(startHeading, endHeading);
    }

    if (text.length >= 40) {
      sections.push({ title, text });
    }
  }

  // Only treat the file as multi-chapter if splitting actually yields a
  // useful structure. One stray heading at the top of an otherwise-normal
  // chapter shouldn't trigger this path.
  if (sections.length < 2) return [];
  return sections;
}

function walkSiblingText(start: Element, end: Element | undefined): string {
  const parts: string[] = [];
  let node: Node | null = start.nextSibling;
  while (node && node !== end) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (text) parts.push(text);
    node = node.nextSibling;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
