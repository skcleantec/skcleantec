import type { ScheduleItem } from '../api/schedule';
import { isActivePartnerShareSource, isActiveTenantShare } from './tenantShareSettlement';

/** 타업체 배정 — `타-{업체명}` */
export function formatExternalAssigneeShort(name: string): string {
  const n = name.trim();
  return n ? `타-${n}` : '타-';
}

/** 파트너 연계 — `파·{업체명}` */
export function formatPartnerAssigneeShort(name: string): string {
  const n = name.trim();
  return n ? `파·${n}` : '파·';
}

export function formatScheduleLeaderSummary(item: ScheduleItem): string {
  const share = item.tenantShare;
  if (share && isActiveTenantShare(share)) {
    return formatPartnerAssigneeShort(share.partnerName);
  }
  if (item.assignments.length === 0) return '';
  return item.assignments
    .map((a) => {
      const u = a.teamLeader;
      if (u.role === 'EXTERNAL_PARTNER') {
        const name = u.externalCompany?.name?.trim() || u.name?.trim() || '';
        return formatExternalAssigneeShort(name);
      }
      return u.name?.trim() ?? '';
    })
    .filter(Boolean)
    .join('/');
}

export function formatPartnerAssignmentLabel(
  share: ScheduleItem['tenantShare'],
): string | null {
  if (!share || !isActivePartnerShareSource(share)) return null;
  return formatPartnerAssigneeShort(share.partnerName);
}
