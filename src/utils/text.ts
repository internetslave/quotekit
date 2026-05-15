export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateReadingMinutes(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / 220));
}

export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z"“])/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0)
    .slice(0, 120);
}

export function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function yesterdayKey(date = new Date()): string {
  const previous = new Date(date);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
