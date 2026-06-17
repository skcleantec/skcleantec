import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HelpCaptureEntry, HelpDescriptionEntry, HelpScreenEntry } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PRODUCT_ROOT, '../..');

const PATHS = {
  captures: path.join(PRODUCT_ROOT, 'output', 'captures.json'),
  descriptions: path.join(PRODUCT_ROOT, 'output', 'descriptions.json'),
  screenshotsSrc: path.join(PRODUCT_ROOT, 'output', 'assets', 'screenshots'),
  dataJson: path.join(REPO_ROOT, 'client', 'public', 'help', 'data.json'),
  screenshotsDest: path.join(REPO_ROOT, 'client', 'public', 'help', 'screenshots'),
};

async function readJsonFile<T>(filePath: string, label: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`${label} 파일을 찾을 수 없습니다: ${filePath}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} JSON 파싱 실패: ${filePath}`);
  }
}

function assertCapture(entry: HelpCaptureEntry, index: number): HelpCaptureEntry {
  const prefix = `captures[${index}]`;
  if (entry.role !== 'admin' && entry.role !== 'team') {
    throw new Error(`${prefix}: role 은 admin 또는 team 여야 합니다.`);
  }
  if (!String(entry.module ?? '').trim()) throw new Error(`${prefix}: module 이 필요합니다.`);
  if (!String(entry.title ?? '').trim()) throw new Error(`${prefix}: title 이 필요합니다.`);
  if (!String(entry.path ?? '').trim()) throw new Error(`${prefix}: path 가 필요합니다.`);
  if (!Number.isFinite(Number(entry.moduleOrder))) {
    throw new Error(`${prefix}: moduleOrder 가 숫자여야 합니다.`);
  }
  return {
    role: entry.role,
    module: String(entry.module).trim(),
    moduleOrder: Number(entry.moduleOrder),
    title: String(entry.title).trim(),
    path: String(entry.path).trim(),
    screenshotFile: String(entry.screenshotFile ?? '').trim(),
  };
}

function buildDescriptionMap(entries: HelpDescriptionEntry[]): Map<string, HelpDescriptionEntry> {
  const map = new Map<string, HelpDescriptionEntry>();
  for (const row of entries) {
    const key = String(row.path ?? '').trim();
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

function mergeEntries(
  captures: HelpCaptureEntry[],
  descriptions: Map<string, HelpDescriptionEntry>
): HelpScreenEntry[] {
  return captures.map((cap) => {
    const desc = descriptions.get(cap.path);
    return {
      role: cap.role,
      module: cap.module,
      moduleOrder: cap.moduleOrder,
      title: cap.title,
      path: cap.path,
      screenshotFile: cap.screenshotFile,
      summary: String(desc?.summary ?? '').trim(),
      markdown: String(desc?.markdown ?? '').trim(),
    };
  });
}

function sortEntries(entries: HelpScreenEntry[]): HelpScreenEntry[] {
  return [...entries].sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    if (a.module !== b.module) return a.module.localeCompare(b.module, 'ko');
    return a.title.localeCompare(b.title, 'ko');
  });
}

async function copyScreenshots(srcDir: string, destDir: string): Promise<number> {
  await mkdir(destDir, { recursive: true });

  let names: string[];
  try {
    names = await readdir(srcDir);
  } catch {
    console.warn(`[build-site] 스크린샷 원본 폴더 없음 — 건너뜀: ${srcDir}`);
    return 0;
  }

  const pngs = names.filter((n) => n.toLowerCase().endsWith('.png'));
  for (const name of pngs) {
    await cp(path.join(srcDir, name), path.join(destDir, name), { force: true });
  }
  return pngs.length;
}

/** 기존 복사본 중 원본에 없는 PNG 정리(선택적 — stale 제거) */
async function pruneOrphanScreenshots(srcDir: string, destDir: string): Promise<void> {
  let srcNames: Set<string>;
  try {
    const names = await readdir(srcDir);
    srcNames = new Set(names.filter((n) => n.toLowerCase().endsWith('.png')));
  } catch {
    return;
  }

  let destNames: string[];
  try {
    destNames = await readdir(destDir);
  } catch {
    return;
  }

  for (const name of destNames) {
    if (!name.toLowerCase().endsWith('.png')) continue;
    if (!srcNames.has(name)) {
      await rm(path.join(destDir, name), { force: true });
    }
  }
}

export async function buildHelpSite(options?: { pruneScreenshots?: boolean }): Promise<void> {
  const capturesRaw = await readJsonFile<unknown>(PATHS.captures, 'captures.json');
  if (!Array.isArray(capturesRaw)) {
    throw new Error('captures.json 은 배열이어야 합니다.');
  }
  const captures = capturesRaw.map((row, i) => assertCapture(row as HelpCaptureEntry, i));

  const descriptionsRaw = await readJsonFile<unknown>(PATHS.descriptions, 'descriptions.json');
  if (!Array.isArray(descriptionsRaw)) {
    throw new Error('descriptions.json 은 배열이어야 합니다.');
  }
  const descriptionMap = buildDescriptionMap(descriptionsRaw as HelpDescriptionEntry[]);

  const merged = sortEntries(mergeEntries(captures, descriptionMap));

  await mkdir(path.dirname(PATHS.dataJson), { recursive: true });
  await writeFile(PATHS.dataJson, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  const copied = await copyScreenshots(PATHS.screenshotsSrc, PATHS.screenshotsDest);
  if (options?.pruneScreenshots !== false) {
    await pruneOrphanScreenshots(PATHS.screenshotsSrc, PATHS.screenshotsDest);
  }

  let destListing: string[] = [];
  try {
    destListing = await readdir(PATHS.screenshotsDest);
  } catch {
    destListing = [];
  }
  const destSet = new Set(destListing);
  const notFound = merged.filter((e) => e.screenshotFile && !destSet.has(e.screenshotFile));

  console.log(`[build-site] data.json → ${PATHS.dataJson} (${merged.length} screens)`);
  console.log(`[build-site] screenshots → ${PATHS.screenshotsDest} (${copied} copied)`);
  if (notFound.length > 0) {
    console.warn(
      `[build-site] 스크린샷 파일 없음 ${notFound.length}건:`,
      notFound.map((e) => e.screenshotFile).join(', ')
    );
  }
}

buildHelpSite().catch((err) => {
  console.error('[build-site] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
