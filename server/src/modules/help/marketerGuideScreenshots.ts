import { promises as fs } from 'fs';
import { resolveHelpStaticPath } from './helpScreenshotsPath.js';

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

function marketerGuideScreenshotsJsonPath(): string {
  return resolveHelpStaticPath('help', 'marketer-guide.screenshots.json');
}

let cachedAllowed: Set<string> | null = null;

export async function loadMarketerGuideScreenshotCatalog(): Promise<MarketerGuideScreenshotMeta[]> {
  try {
    const jsonPath = marketerGuideScreenshotsJsonPath();
    const raw = await fs.readFile(jsonPath, 'utf8');
    const data = JSON.parse(raw) as MarketerGuideScreenshotMeta[];
    if (!Array.isArray(data)) {
      throw new Error('marketer-guide.screenshots.json 형식 오류');
    }
    return data;
  } catch {
    return MARKETER_GUIDE_SCREENSHOT_FILENAMES.map((filename) => ({
      filename,
      label: filename,
      chapterIds: [],
    }));
  }
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
