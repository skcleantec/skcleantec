/** 관리자 GNB 항목 — 드래그 순서 저장용 id */

export type AdminNavId =
  | 'dashboard'
  | 'inquiries'
  | 'schedule'
  | 'team-leaders'
  | 'teams'
  | 'orderforms'
  | 'cs'
  | 'advertising'
  | 'messages';

export const ADMIN_NAV_DEF: Record<
  AdminNavId,
  { to: string; label: string; adminOnly?: boolean }
> = {
  dashboard: { to: '/admin/dashboard', label: '대시보드' },
  inquiries: { to: '/admin/inquiries', label: '접수 목록' },
  schedule: { to: '/admin/schedule', label: '스케줄 표' },
  'team-leaders': { to: '/admin/team-leaders', label: '사용자관리', adminOnly: true },
  teams: { to: '/admin/teams', label: '팀 관리', adminOnly: true },
  orderforms: { to: '/admin/orderforms', label: '발주서' },
  cs: { to: '/admin/cs', label: 'C/S 관리' },
  advertising: { to: '/admin/advertising', label: '광고비' },
  messages: { to: '/admin/messages', label: '메시지' },
};

const STORAGE_ADMIN = 'sk_admin_nav_order_v1_admin';
const STORAGE_NON_ADMIN = 'sk_admin_nav_order_v1_marketer';

export const DEFAULT_ADMIN_NAV_ORDER: AdminNavId[] = [
  'dashboard',
  'inquiries',
  'schedule',
  'team-leaders',
  'teams',
  'orderforms',
  'cs',
  'advertising',
  'messages',
];

/** 관리자 전용 메뉴 제외 — 마케터 등 */
export const DEFAULT_NON_ADMIN_NAV_ORDER: AdminNavId[] = [
  'dashboard',
  'inquiries',
  'schedule',
  'orderforms',
  'cs',
  'advertising',
  'messages',
];

export function canShowAdminNavItem(id: AdminNavId, isAdmin: boolean): boolean {
  const d = ADMIN_NAV_DEF[id];
  return !d.adminOnly || isAdmin;
}

function mergeWithDefaults(saved: string[], defaults: AdminNavId[]): AdminNavId[] {
  const valid = new Set<AdminNavId>();
  const out: AdminNavId[] = [];
  for (const raw of saved) {
    if (!(raw in ADMIN_NAV_DEF)) continue;
    const id = raw as AdminNavId;
    if (valid.has(id)) continue;
    valid.add(id);
    out.push(id);
  }
  for (const id of defaults) {
    if (!valid.has(id)) out.push(id);
  }
  return out;
}

export function loadAdminNavOrder(isAdmin: boolean): AdminNavId[] {
  const defaults = isAdmin ? DEFAULT_ADMIN_NAV_ORDER : DEFAULT_NON_ADMIN_NAV_ORDER;
  const key = isAdmin ? STORAGE_ADMIN : STORAGE_NON_ADMIN;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaults;
    const merged = mergeWithDefaults(
      parsed.filter((x): x is string => typeof x === 'string'),
      defaults
    );
    return merged.filter((id) => canShowAdminNavItem(id, isAdmin));
  } catch {
    return defaults;
  }
}

export function saveAdminNavOrder(isAdmin: boolean, order: AdminNavId[]): void {
  const key = isAdmin ? STORAGE_ADMIN : STORAGE_NON_ADMIN;
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    /* Safari 사설 모드 등 */
  }
}

/** 드래그한 항목을 대상 앞에 끼워 넣기 */
export function insertBefore(
  order: AdminNavId[],
  dragId: AdminNavId,
  targetId: AdminNavId
): AdminNavId[] {
  if (dragId === targetId) return order;
  const next = order.filter((id) => id !== dragId);
  const ti = next.indexOf(targetId);
  if (ti === -1) return order;
  next.splice(ti, 0, dragId);
  return next;
}
