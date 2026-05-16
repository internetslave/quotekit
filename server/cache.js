// Persistent file-backed cache for chapter-kit results.
//
// Why server-side: the client already caches in IndexedDB, but that cache is
// per-browser. When the user clears site data, switches to a different
// device on the same tailnet, or wipes IndexedDB through devtools, we'd
// otherwise re-pay OpenAI to regenerate identical content. The server cache
// is keyed on the chapter text hash plus the prompt version, so it stays
// valid until either side changes.
//
// Storage is a single JSON file in ./.cache/. Reads are O(1) from an
// in-memory map. Writes are debounced so a flurry of generations doesn't
// thrash the disk.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";

const CACHE_DIR = process.env.READQUEST_CACHE_DIR
  ? process.env.READQUEST_CACHE_DIR
  : "./.cache";
const CACHE_FILE = join(CACHE_DIR, "chapter-kits.json");
const MAX_ENTRIES = 500;
const WRITE_DEBOUNCE_MS = 800;

let memory = null;       // Map<string, { kit, hits, lastUsed }>
let writeTimer = null;
let loadPromise = null;

async function load() {
  if (memory) return memory;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    memory = new Map();
    try {
      const raw = await readFile(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      for (const [key, value] of Object.entries(parsed)) {
        memory.set(key, value);
      }
    } catch (err) {
      if (err && err.code !== "ENOENT") {
        console.warn("[cache] could not read", CACHE_FILE, err.message);
      }
      // Cold start; in-memory map stays empty.
    }
    return memory;
  })();
  return loadPromise;
}

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(persist, WRITE_DEBOUNCE_MS);
}

async function persist() {
  writeTimer = null;
  if (!memory) return;
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    const obj = Object.fromEntries(memory.entries());
    // Atomic-ish: write to tmp then rename, so a crash can't corrupt the
    // file mid-write.
    const tmp = CACHE_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(obj), "utf8");
    await rename(tmp, CACHE_FILE);
  } catch (err) {
    console.warn("[cache] persist failed:", err.message);
  }
}

function evictIfFull(map) {
  if (map.size <= MAX_ENTRIES) return;
  // Drop the least-recently-used entry.
  let oldestKey = null;
  let oldestUsed = Infinity;
  for (const [key, entry] of map) {
    if (entry.lastUsed < oldestUsed) {
      oldestUsed = entry.lastUsed;
      oldestKey = key;
    }
  }
  if (oldestKey) map.delete(oldestKey);
}

export function chapterCacheKey(normalisedText, promptVersion) {
  const hash = createHash("sha256")
    .update(normalisedText, "utf8")
    .digest("hex");
  return `${hash}:${promptVersion}`;
}

export function normaliseForHash(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

export async function getCachedKit(key) {
  const map = await load();
  const entry = map.get(key);
  if (!entry) return null;
  entry.hits = (entry.hits || 0) + 1;
  entry.lastUsed = Date.now();
  scheduleWrite();
  return entry.kit;
}

export async function setCachedKit(key, kit) {
  const map = await load();
  map.set(key, { kit, hits: 0, lastUsed: Date.now() });
  evictIfFull(map);
  scheduleWrite();
}

export async function stats() {
  const map = await load();
  let totalHits = 0;
  for (const v of map.values()) totalHits += v.hits || 0;
  return { entries: map.size, totalHits };
}
