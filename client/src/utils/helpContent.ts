import type { HelpModuleGroup, HelpRole, HelpScreenEntry } from '../types/helpContent';

export const HELP_DATA_URL = '/help/data.json';

export const HELP_ROLE_LABELS: Record<HelpRole, string> = {
  admin: '관리자',
  team: '팀장',
};

export function parseHelpRole(raw: string | null): HelpRole {
  return raw === 'admin' ? 'admin' : 'team';
}

export function slugifyHelpModule(module: string): string {
  return module
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u3131-\uD79D-]+/g, '');
}

export function helpModuleDomId(module: string): string {
  return `help-module-${slugifyHelpModule(module) || 'other'}`;
}

export async function fetchHelpContent(): Promise<HelpScreenEntry[]> {
  const res = await fetch(HELP_DATA_URL);
  if (!res.ok) throw new Error('도움말 데이터를 불러올 수 없습니다.');
  const data = (await res.json()) as HelpScreenEntry[];
  if (!Array.isArray(data)) throw new Error('도움말 데이터 형식이 올바르지 않습니다.');
  return data;
}

export function sortHelpEntries(entries: HelpScreenEntry[]): HelpScreenEntry[] {
  return [...entries].sort((a, b) => {
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    if (a.module !== b.module) return a.module.localeCompare(b.module, 'ko');
    const ao = a.itemOrder ?? 999;
    const bo = b.itemOrder ?? 999;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title, 'ko');
  });
}

export function groupHelpByModule(entries: HelpScreenEntry[]): HelpModuleGroup[] {
  const map = new Map<string, HelpModuleGroup>();
  for (const item of sortHelpEntries(entries)) {
    const key = `${item.role}:${item.module}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, {
        module: item.module,
        moduleOrder: item.moduleOrder,
        items: [item],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.moduleOrder - b.moduleOrder);
}

export function filterHelpEntries(
  entries: HelpScreenEntry[],
  role: HelpRole,
  query: string
): HelpScreenEntry[] {
  const q = query.trim().toLowerCase();
  return sortHelpEntries(entries).filter((item) => {
    if (item.role !== role) return false;
    if (!q) return true;
    const haystack = `${item.title}\n${item.summary}\n${item.markdown}\n${item.module}\n${item.path}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function screenshotUrl(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return '';
  return `/help/screenshots/${encodeURIComponent(trimmed)}`;
}
