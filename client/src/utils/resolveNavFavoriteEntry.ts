import type { AdminSideNavIconId } from '../components/layout/adminSideNavIcons';
import { resolveAdminSideNavIcon } from '../components/layout/adminSideNavIcons';
import { ADMIN_INQUIRIES_NAV_ITEMS } from '../constants/adminInquiriesNav';
import { ADMIN_NAV_DEF, type AdminNavId } from '../constants/adminNav';
import { ADMIN_TEAM_LEADERS_NAV_ITEMS } from '../constants/adminTeamLeadersNav';
import { getAdminAdvertisingNavItems } from '../constants/adminAdvertisingNav';
import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';
import { adminGnbNavKey, adminSideNavKey, teamGnbNavKey } from './navFavorites';

export type ResolvedAdminGnbFavorite = {
  kind: 'admin-gnb';
  key: string;
  gnbId: AdminNavId;
  to: string;
  label: string;
};

export type ResolvedAdminSideFavorite = {
  kind: 'admin-side';
  key: string;
  to: string;
  label: string;
  icon: AdminSideNavIconId;
  sectionLabel?: string;
};

export type ResolvedTeamGnbFavorite = {
  kind: 'team-gnb';
  key: string;
  to: string;
  label: string;
  teamIcon:
    | 'dashboard'
    | 'assignments'
    | 'schedule'
    | 'settlement'
    | 'marketplace'
    | 'dayoffs'
    | 'cs'
    | 'messages';
};

export type ResolvedNavFavorite =
  | ResolvedAdminGnbFavorite
  | ResolvedAdminSideFavorite
  | ResolvedTeamGnbFavorite;

const TEAM_PATH_META: Record<
  string,
  { label: string; teamIcon: ResolvedTeamGnbFavorite['teamIcon'] }
> = {
  '/team/dashboard': { label: '대시보드', teamIcon: 'dashboard' },
  '/team/assignments': { label: '배정목록', teamIcon: 'assignments' },
  '/team/schedule': { label: '스케줄', teamIcon: 'schedule' },
  '/team/settlement': { label: '정산', teamIcon: 'settlement' },
  '/team/db-marketplace': { label: '정보공유', teamIcon: 'marketplace' },
  '/team/dayoffs': { label: '휴무', teamIcon: 'dayoffs' },
  '/team/cs': { label: 'C/S', teamIcon: 'cs' },
  '/team/messages': { label: '메시지', teamIcon: 'messages' },
  '/team/e-contracts': { label: '전자 계약', teamIcon: 'dashboard' },
  '/team/training': { label: '현장팀장 교육자료', teamIcon: 'dashboard' },
};

/** 페이지 h1 제목과 사이드 라벨이 다른 경우 — 즐겨찾기 저장 라벨 */
const PAGE_FAVORITE_LABEL_OVERRIDES: Record<string, string> = {
  '/admin/inquiries': '서비스접수',
  '/admin/inquiries/followup': '부재·보류',
  '/admin/inquiries/order-forms': '발주서 목록',
  '/admin/inquiries/order-issue': '발주서 발급',
  '/admin/inquiries/order-customer-preview': '발주서설정',
  '/admin/inquiries/leads': '문의내역',
  '/admin/inquiries/leads/settings': '문의 폼·링크',
  '/admin/crm': '텔레CRM',
  '/admin/crm/soomgo': '텔레CRM',
  '/admin/service-zones': '서비스 권역',
  '/admin/team-leaders/leader-stats': '팀장',
  '/admin/team-leaders/e-contracts': '전자계약',
  '/admin/team-leaders/e-contracts/definitions': '전자계약 양식',
  '/admin/team-leaders/e-contracts/issuer-profile': '전자계약 — 발행측(갑) 정보',
  '/admin/team-leaders/e-contracts/field-settings': '체결·매핑 필드 설정',
  '/admin/team-leaders/e-contracts/team-overview': '체결 기록',
};

type PagePathEntry = { path: string; navKey: string; label: string };

function collectPagePathEntries(items: AdminSideNavItem[]): PagePathEntry[] {
  const out: PagePathEntry[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      out.push({
        path: item.to,
        navKey: adminSideNavKey(item.to),
        label: PAGE_FAVORITE_LABEL_OVERRIDES[item.to] ?? item.label,
      });
      continue;
    }
    for (const child of item.children) {
      out.push({
        path: child.to,
        navKey: adminSideNavKey(child.to),
        label: PAGE_FAVORITE_LABEL_OVERRIDES[child.to] ?? child.label,
      });
    }
  }
  return out;
}

let pagePathEntriesCache: PagePathEntry[] | null = null;

function getAllPagePathEntries(): PagePathEntry[] {
  if (pagePathEntriesCache) return pagePathEntriesCache;
  const entries: PagePathEntry[] = [
    ...collectPagePathEntries(ADMIN_INQUIRIES_NAV_ITEMS),
    ...collectPagePathEntries(ADMIN_TEAM_LEADERS_NAV_ITEMS),
    ...collectPagePathEntries(getAdminAdvertisingNavItems(true)),
    ...Object.entries(ADMIN_NAV_DEF).map(([id, def]) => ({
      path: def.to,
      navKey: adminGnbNavKey(id),
      label: PAGE_FAVORITE_LABEL_OVERRIDES[def.to] ?? def.label,
    })),
    ...Object.entries(TEAM_PATH_META).map(([path, meta]) => ({
      path,
      navKey: teamGnbNavKey(path),
      label: PAGE_FAVORITE_LABEL_OVERRIDES[path] ?? meta.label,
    })),
    ...Object.entries(PAGE_FAVORITE_LABEL_OVERRIDES)
      .filter(([path]) => !path.startsWith('/team/'))
      .map(([path, label]) => ({
        path,
        navKey: adminSideNavKey(path),
        label,
      })),
  ];
  const byPath = new Map<string, PagePathEntry>();
  for (const entry of entries) {
    if (!byPath.has(entry.path)) byPath.set(entry.path, entry);
  }
  pagePathEntriesCache = [...byPath.values()].sort((a, b) => b.path.length - a.path.length);
  return pagePathEntriesCache;
}

/** 현재 페이지 pathname → 즐겨찾기 key·라벨 (페이지 제목 ★용) */
export function resolvePageNavFavoriteFromPath(
  pathname: string,
): { navKey: string; label: string } | null {
  const path = pathname.split('?')[0].split('#')[0];
  for (const entry of getAllPagePathEntries()) {
    if (path === entry.path || path.startsWith(`${entry.path}/`)) {
      return { navKey: entry.navKey, label: entry.label };
    }
  }
  return null;
}

function indexAdminSideItems(
  items: AdminSideNavItem[],
  sectionLabel?: string,
  out = new Map<string, { label: string; icon: AdminSideNavIconId; sectionLabel?: string }>(),
) {
  for (const item of items) {
    if (item.type === 'link') {
      out.set(item.to, {
        label: item.label,
        icon: item.icon ?? resolveAdminSideNavIcon(item.to),
        sectionLabel,
      });
      continue;
    }
    for (const child of item.children) {
      out.set(child.to, {
        label: child.label,
        icon: child.icon ?? resolveAdminSideNavIcon(child.to),
        sectionLabel: sectionLabel ?? item.label,
      });
    }
  }
  return out;
}

let adminSideLookup: Map<string, { label: string; icon: AdminSideNavIconId; sectionLabel?: string }> | null =
  null;

function getAdminSideLookup() {
  if (adminSideLookup) return adminSideLookup;
  adminSideLookup = new Map();
  indexAdminSideItems(ADMIN_INQUIRIES_NAV_ITEMS, '서비스접수', adminSideLookup);
  indexAdminSideItems(ADMIN_TEAM_LEADERS_NAV_ITEMS, '관리자 전용', adminSideLookup);
  indexAdminSideItems(getAdminAdvertisingNavItems(true), '광고비', adminSideLookup);
  for (const entry of getAllPagePathEntries()) {
    if (entry.navKey.startsWith('admin:side:') && !adminSideLookup.has(entry.path)) {
      adminSideLookup.set(entry.path, {
        label: entry.label,
        icon: resolveAdminSideNavIcon(entry.path),
      });
    }
  }
  return adminSideLookup;
}

export function resolveNavFavoriteEntry(
  key: string,
  labelsCache: Record<string, string>,
): ResolvedNavFavorite | null {
  if (key.startsWith('admin:gnb:')) {
    const gnbId = key.slice('admin:gnb:'.length) as AdminNavId;
    if (!(gnbId in ADMIN_NAV_DEF)) return null;
    const def = ADMIN_NAV_DEF[gnbId];
    return {
      kind: 'admin-gnb',
      key: adminGnbNavKey(gnbId),
      gnbId,
      to: def.to,
      label: labelsCache[key] ?? def.label,
    };
  }

  if (key.startsWith('admin:side:')) {
    const to = key.slice('admin:side:'.length);
    if (!to.startsWith('/')) return null;
    const meta = getAdminSideLookup().get(to);
    return {
      kind: 'admin-side',
      key: adminSideNavKey(to),
      to,
      label: labelsCache[key] ?? meta?.label ?? to.split('/').pop() ?? to,
      icon: meta?.icon ?? resolveAdminSideNavIcon(to),
      sectionLabel: meta?.sectionLabel,
    };
  }

  if (key.startsWith('team:gnb:')) {
    const to = key.slice('team:gnb:'.length);
    if (!to.startsWith('/team/')) return null;
    const meta = TEAM_PATH_META[to];
    return {
      kind: 'team-gnb',
      key: teamGnbNavKey(to),
      to,
      label: labelsCache[key] ?? meta?.label ?? to,
      teamIcon: meta?.teamIcon ?? 'dashboard',
    };
  }

  return null;
}

export function resolveNavFavoriteEntries(
  keys: readonly string[],
  labelsCache: Record<string, string>,
): ResolvedNavFavorite[] {
  const out: ResolvedNavFavorite[] = [];
  for (const key of keys) {
    const entry = resolveNavFavoriteEntry(key, labelsCache);
    if (entry) out.push(entry);
  }
  return out;
}

/** 팀 GNB 즐겨찾기 토글용 — 표시 라벨(한글) */
export function teamNavFavoriteLabel(path: string): string {
  return TEAM_PATH_META[path]?.label ?? path;
}

export { teamGnbNavKey };
