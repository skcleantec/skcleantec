import path from 'path';
import { promises as fs } from 'fs';

export type MarketerGuideScreenshotMeta = {
  filename: string;
  label: string;
  chapterIds: string[];
};

const SCREENSHOTS_JSON = path.join(
  process.cwd(),
  'client',
  'public',
  'help',
  'marketer-guide.screenshots.json',
);

let cachedAllowed: Set<string> | null = null;

export async function loadMarketerGuideScreenshotCatalog(): Promise<MarketerGuideScreenshotMeta[]> {
  const raw = await fs.readFile(SCREENSHOTS_JSON, 'utf8');
  const data = JSON.parse(raw) as MarketerGuideScreenshotMeta[];
  if (!Array.isArray(data)) {
    throw new Error('marketer-guide.screenshots.json 형식 오류');
  }
  return data;
}

export async function allowedMarketerGuideScreenshotFilenames(): Promise<Set<string>> {
  if (cachedAllowed) return cachedAllowed;
  const catalog = await loadMarketerGuideScreenshotCatalog();
  cachedAllowed = new Set(catalog.map((item) => item.filename));
  return cachedAllowed;
}

export function isAllowedMarketerGuideScreenshotFilename(filename: string): boolean {
  return /^s[\w-]+\.(png|jpg|jpeg|webp)$/i.test(filename);
}
