import { promises as fs } from 'fs';
import { helpStaticPathCandidates } from './helpScreenshotsPath.js';

export type MarketerGuideScreenshotMeta = {
  filename: string;
  label: string;
  chapterIds: string[];
};

/** JSON 읽기 실패 시 업로드 화이트리스트 폴백 */
export const MARKETER_GUIDE_SCREENSHOT_FILENAMES = [
  's02_dashboard.png',
  's04_inquiries.png',
  's06_order_issue.png',
  's07_order_forms.png',
  's08_quotations.png',
  's09_cs.png',
  's10_payback.png',
  's11_advertising.png',
  's14_ad_settings.png',
  's15_schedule.png',
  's15b_messages.png',
  's15c_db_marketplace.png',
  's16_team_leaders.png',
] as const;

function normalizeCatalogEntry(raw: unknown): MarketerGuideScreenshotMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<MarketerGuideScreenshotMeta>;
  const filename = String(row.filename ?? '').trim();
  if (!filename) return null;
  const chapterIds = Array.isArray(row.chapterIds)
    ? row.chapterIds.filter((id): id is string => typeof id === 'string' && /^\d{2}$/.test(id))
    : [];
  return {
    filename,
    label: String(row.label ?? filename).trim() || filename,
    chapterIds,
  };
}

async function readMarketerGuideCatalogFromDisk(): Promise<MarketerGuideScreenshotMeta[]> {
  const paths = helpStaticPathCandidates('help', 'marketer-guide.screenshots.json');
  const merged: MarketerGuideScreenshotMeta[] = [];

  for (const jsonPath of paths) {
    try {
      const raw = await fs.readFile(jsonPath, 'utf8');
      const data = JSON.parse(raw) as unknown[];
      if (!Array.isArray(data)) continue;
      for (const entry of data) {
        const item = normalizeCatalogEntry(entry);
        if (!item) continue;
        const idx = merged.findIndex((m) => m.filename === item.filename);
        if (idx < 0) {
          merged.push(item);
        } else {
          merged[idx] = {
            ...merged[idx],
            label: merged[idx].label || item.label,
            chapterIds: Array.from(new Set([...merged[idx].chapterIds, ...item.chapterIds])).sort(),
          };
        }
      }
    } catch {
      /* try next path */
    }
  }

  return merged;
}

export async function loadMarketerGuideScreenshotCatalog(): Promise<MarketerGuideScreenshotMeta[]> {
  const fromDisk = await readMarketerGuideCatalogFromDisk();
  if (fromDisk.length > 0) return fromDisk;

  return MARKETER_GUIDE_SCREENSHOT_FILENAMES.map((filename) => ({
    filename,
    label: filename,
    chapterIds: [],
  }));
}

export async function allowedMarketerGuideScreenshotFilenames(): Promise<Set<string>> {
  const catalog = await loadMarketerGuideScreenshotCatalog();
  const allowed = new Set(catalog.map((item) => item.filename));
  for (const filename of MARKETER_GUIDE_SCREENSHOT_FILENAMES) {
    allowed.add(filename);
  }
  return allowed;
}

export function isAllowedMarketerGuideScreenshotFilename(filename: string): boolean {
  return /^s[\w-]+\.(png|jpg|jpeg|webp)$/i.test(filename);
}
