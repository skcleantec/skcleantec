import type { UserItem } from '../api/users';

type AssignmentLike = {
  teamLeader: {
    id: string;
    role?: string;
    name: string;
    email?: string;
    phone?: string | null;
    externalCompanyId?: string | null;
    externalCompany?: { id: string; name: string } | null;
  };
};

/** assignable-schedule에서 빠진 「사용 중지」 타업체 — 기존 접수 편집 시 현재 담당 표시용 */
export function mergeExternalPartnersFromAssignments(
  assignable: UserItem[],
  assignments: AssignmentLike[] | undefined | null,
): UserItem[] {
  if (!assignments?.length) return assignable;
  const seen = new Set(assignable.map((u) => u.id));
  const extra: UserItem[] = [];
  for (const a of assignments) {
    const u = a.teamLeader;
    const role = u.role ?? (u.externalCompany || u.externalCompanyId ? 'EXTERNAL_PARTNER' : '');
    if (role !== 'EXTERNAL_PARTNER' || seen.has(u.id)) continue;
    extra.push({
      id: u.id,
      email: u.email ?? '',
      name: u.name,
      phone: u.phone ?? null,
      role: 'EXTERNAL_PARTNER',
      externalCompanyId: u.externalCompany?.id ?? u.externalCompanyId ?? null,
      externalCompanyName: u.externalCompany?.name ?? null,
    });
  }
  if (extra.length === 0) return assignable;
  return [...assignable, ...extra];
}

export function isExternalCompanyUsageDisabled(usageDisabledAt: string | null | undefined): boolean {
  return usageDisabledAt != null && usageDisabledAt !== '';
}
