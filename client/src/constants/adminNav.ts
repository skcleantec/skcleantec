/** 관리자 GNB 항목 — 드래그 순서 저장용 id */

import {
  ADMIN_NAV_MODULE_MAP,
  hasFeature,
  type TenantFeatureModuleId,
} from '@shared/tenantFeatureModules';

export type AdminNavId =
  | 'dashboard'
  | 'inquiries'
  | 'schedule'
  | 'db-marketplace'
  | 'team-leaders'
  | 'cs'
  | 'advertising'
  | 'messages';

export type AdminNavContext = {
  isAdmin: boolean;
  /** null = /auth/me features 로드 전 — 기존처럼 모듈 필터 생략 */
  enabledModules: readonly string[] | null;
};

export function canShowAdminNavItem(id: AdminNavId, ctx: AdminNavContext | boolean): boolean {
  const isAdmin = typeof ctx === 'boolean' ? ctx : ctx.isAdmin;
  const enabledModules = typeof ctx === 'boolean' ? null : ctx.enabledModules;
  const d = ADMIN_NAV_DEF[id];
  if (d.adminOnly && !isAdmin) return false;
  if (!enabledModules) return true;
  const mod = ADMIN_NAV_MODULE_MAP[id as keyof typeof ADMIN_NAV_MODULE_MAP];
  if (!mod) return true;
  return hasFeature(enabledModules, mod as TenantFeatureModuleId);
}

export const ADMIN_NAV_DEF: Record<
  AdminNavId,
  { to: string; label: string; adminOnly?: boolean }
> = {
  dashboard: { to: '/admin/dashboard', label: '대시보드' },
  /** 상단 GNB 명칭 — 본문 첫 탭은 `AdminInquiriesLayout`에서 「접수목록」으로 별도 표기 */
  inquiries: { to: '/admin/inquiries', label: '서비스접수' },
  schedule: { to: '/admin/schedule', label: '스케쥴' },
  'db-marketplace': { to: '/admin/db-marketplace', label: '정보공유' },
  /** 팀장·마케터·타업체 등 — 관리자만 GNB에 노출 */
  'team-leaders': { to: '/admin/team-leaders', label: '관리자 전용', adminOnly: true },
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
  'db-marketplace',
  'team-leaders',
  'cs',
  'advertising',
  'messages',
];

/** 관리자 전용 메뉴 제외 — 마케터 등 */
export const DEFAULT_NON_ADMIN_NAV_ORDER: AdminNavId[] = [
  'dashboard',
  'inquiries',
  'schedule',
  'cs',
  'advertising',
  'messages',
];


function navContext(isAdmin: boolean, enabledModules: readonly string[] | null): AdminNavContext {
  return { isAdmin, enabledModules };
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

export function loadAdminNavOrder(isAdmin: boolean, enabledModules: readonly string[] | null = null): AdminNavId[] {
  const defaults = isAdmin ? DEFAULT_ADMIN_NAV_ORDER : DEFAULT_NON_ADMIN_NAV_ORDER;
  const key = isAdmin ? STORAGE_ADMIN : STORAGE_NON_ADMIN;
  const ctx = navContext(isAdmin, enabledModules);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults.filter((id) => canShowAdminNavItem(id, ctx));
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaults.filter((id) => canShowAdminNavItem(id, ctx));
    const merged = mergeWithDefaults(
      parsed.filter((x): x is string => typeof x === 'string'),
      defaults
    );
    return merged.filter((id) => canShowAdminNavItem(id, ctx));
  } catch {
    return defaults.filter((id) => canShowAdminNavItem(id, ctx));
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
