// SHA-256 of a UTF-8 string, returned as lowercase hex. Used as the
// content-hash key for chapter-kit caching so an edited (or OCR'd) chapter
// invalidates its previous cache entry automatically.
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Stable, short representation of chapter text for cache keys: the input is
// normalised so trivial whitespace differences don't bust the cache.
export async function chapterTextHash(text: string): Promise<string> {
  const normalised = text.replace(/\s+/g, " ").trim();
  return sha256Hex(normalised);
}
