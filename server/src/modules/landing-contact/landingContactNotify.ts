import { broadcastJsonToStaff } from '../realtime/realtimeHub.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { getEmployedStaffUserIds } from '../realtime/navBadgeNotify.js';
import { LANDING_CONTACT_WS_TYPE } from './landingContact.constants.js';

export type LandingContactWsPayload = {
  type: typeof LANDING_CONTACT_WS_TYPE;
  landingContactId: string;
  customerName: string;
  brandName: string | null;
  summary: string;
};

/** 랜딩 문의 신규 접수 — 상단 알림 바 + GNB·사이드 배지 갱신 */
export async function notifyLandingContactSubmitted(params: {
  tenantId: string;
  landingContactId: string;
  customerName: string;
  brandName?: string | null;
}): Promise<void> {
  const customerName = params.customerName.trim() || '고객';
  const brandSuffix = params.brandName?.trim() ? ` (${params.brandName.trim()})` : '';
  const summary = `랜딩 문의: ${customerName}님 신규 문의${brandSuffix}`;
  const payload: LandingContactWsPayload = {
    type: LANDING_CONTACT_WS_TYPE,
    landingContactId: params.landingContactId,
    customerName,
    brandName: params.brandName?.trim() || null,
    summary,
  };
  broadcastJsonToStaff(payload, params.tenantId);

  const staff = await getEmployedStaffUserIds(params.tenantId);
  if (staff.length > 0) notifyInboxRefresh(staff);
}

/** 상태 변경·전환 후 목록·배지 무음 갱신 */
export async function notifyLandingContactListRefresh(tenantId: string): Promise<void> {
  const staff = await getEmployedStaffUserIds(tenantId);
  if (staff.length > 0) notifyInboxRefresh(staff);
}
