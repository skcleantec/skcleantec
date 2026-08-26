/** Google Play 「청소비서」 업무 앱 — FCM·WebView 딥링크 공통 규약 */

export type StaffAppPushKind =
  | 'assignment'
  | 'schedule_alert'
  | 'message'
  | 'cs'
  | 'db_marketplace'
  | 'happy_call'
  | 'generic';

export type StaffAppPushPayload = {
  kind: StaffAppPushKind;
  title: string;
  body: string;
  /** 앱 WebView React Router 경로. 빈 문자열이면 홈 유지 */
  path: string;
};

/** Android FCM data.type — 알림 탭 시 path 로 이동 */
export const STAFF_APP_PUSH_DATA_TYPE = 'staff-app:navigate';

/** 구버전 앱·무음 갱신용 */
export const STAFF_APP_PUSH_LEGACY_REFRESH_TYPE = 'inbox:refresh';

export function staffAppPushDataRecord(payload: StaffAppPushPayload): Record<string, string> {
  return {
    type: STAFF_APP_PUSH_DATA_TYPE,
    kind: payload.kind,
    title: payload.title,
    body: payload.body,
    path: payload.path,
  };
}

export function isTeamSideStaffRole(role: string | null | undefined): boolean {
  return role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER';
}

/** 해피콜 FCM — 팀장·타업체 담당만 (마케터·사무직 제외) */
export function canReceiveHappyCallPush(role: string | null | undefined): boolean {
  if (role === 'MARKETER' || role === 'OFFICE_STAFF') return false;
  return role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER';
}

export function staffAppMessagesPathForRole(
  role: string | null | undefined,
  opts?: { partnerUserId?: string | null; messageId?: string | null },
): string {
  const base = isTeamSideStaffRole(role) ? '/team/messages' : '/admin/messages';
  const params = new URLSearchParams();
  if (!isTeamSideStaffRole(role) && opts?.partnerUserId?.trim()) {
    params.set('openUser', opts.partnerUserId.trim());
  }
  if (opts?.messageId?.trim()) {
    params.set('openMessage', opts.messageId.trim());
  }
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function staffAppAssignmentPathForRole(
  role: string | null | undefined,
  inquiryId: string,
): string {
  const q = `openInquiry=${encodeURIComponent(inquiryId)}`;
  if (isTeamSideStaffRole(role)) return `/team/assignments?${q}`;
  return `/admin/inquiries?${q}`;
}

export function staffAppCsPathForRole(role: string | null | undefined): string {
  return isTeamSideStaffRole(role) ? '/team/cs' : '/admin/inquiries/cs';
}

export function staffAppDbMarketplacePathForRole(
  role: string | null | undefined,
  listingId?: string | null,
): string {
  const base = isTeamSideStaffRole(role) ? '/team/db-marketplace' : '/admin/db-marketplace';
  const id = listingId?.trim();
  if (!id) return base;
  return `${base}?openListing=${encodeURIComponent(id)}`;
}

export function buildGenericStaffAppPushPayload(): StaffAppPushPayload {
  return {
    kind: 'generic',
    title: '청소비서',
    body: '새 알림이 있습니다. 탭하여 확인하세요.',
    path: '',
  };
}

export type AssignmentPushVariant = 'new' | 'removed';

import type { ScheduleAlertKind } from './scheduleAlerts';
import { SCHEDULE_ALERT_KIND_LABELS } from './scheduleAlerts';

export function buildScheduleAlertPushPayload(params: {
  customerName: string;
  inquiryId: string;
  kind: ScheduleAlertKind;
  summary: string;
  role: string | null | undefined;
}): StaffAppPushPayload {
  const name = params.customerName.trim() || '고객';
  const title = SCHEDULE_ALERT_KIND_LABELS[params.kind];
  const summary = params.summary.trim();
  const body = summary ? `${name} · ${summary}` : `${name}님 ${title}`;
  return {
    kind: 'schedule_alert',
    title,
    body,
    path: staffAppAssignmentPathForRole(params.role, params.inquiryId),
  };
}

export function buildAssignmentPushPayload(params: {
  customerName: string;
  inquiryId: string;
  role: string | null | undefined;
  variant: AssignmentPushVariant;
}): StaffAppPushPayload {
  const name = params.customerName.trim() || '고객';
  const body =
    params.variant === 'new'
      ? `${name}님 접수가 배정되었습니다.`
      : `${name}님 접수 배정이 변경되었습니다.`;
  return {
    kind: 'assignment',
    title: '새 배정',
    body,
    path: staffAppAssignmentPathForRole(params.role, params.inquiryId),
  };
}

export function buildMessagePushPayload(params: {
  senderName: string;
  receiverRole: string | null | undefined;
  senderUserId: string;
  messageId: string;
}): StaffAppPushPayload {
  const sender = params.senderName.trim() || '관리자';
  return {
    kind: 'message',
    title: '새 메시지',
    body: `${sender}님의 메시지가 도착했습니다.`,
    path: staffAppMessagesPathForRole(params.receiverRole, {
      partnerUserId: params.senderUserId,
      messageId: params.messageId,
    }),
  };
}

export function buildInquiryChangePushPayload(params: {
  customerName: string;
  inquiryId: string;
  summary: string;
  role: string | null | undefined;
}): StaffAppPushPayload {
  const name = params.customerName.trim() || '고객';
  const summary = params.summary.trim();
  return {
    kind: 'schedule_alert',
    title: '접수 변경',
    body: summary ? `${name} · ${summary}` : `${name}님 접수가 변경되었습니다.`,
    path: staffAppAssignmentPathForRole(params.role, params.inquiryId),
  };
}

export function buildHappyCallPushPayload(params: {
  customerName: string;
  inquiryId: string;
  variant: 'reminder' | 'overdue';
}): StaffAppPushPayload {
  const name = params.customerName.trim() || '고객';
  const q = `openInquiry=${encodeURIComponent(params.inquiryId)}`;
  if (params.variant === 'overdue') {
    return {
      kind: 'happy_call',
      title: '해피콜 미완',
      body: `${name}님 해피콜을 지금 진행해 주세요.`,
      path: `/team/assignments?${q}`,
    };
  }
  return {
    kind: 'happy_call',
    title: '해피콜 안내',
    body: `${name}님 해피콜을 진행해 주세요.`,
    path: `/team/assignments?${q}`,
  };
}

export type CsPushVariant = 'new' | 'forwarded' | 'updated';

export function buildCsPushPayload(params: {
  variant: CsPushVariant;
  customerName: string;
  role: string | null | undefined;
}): StaffAppPushPayload {
  const name = params.customerName.trim() || '고객';
  let title = 'C/S 알림';
  let body = `${name}님 C/S가 갱신되었습니다.`;
  if (params.variant === 'new') {
    title = 'C/S 접수';
    body = `${name}님 C/S가 접수되었습니다.`;
  } else if (params.variant === 'forwarded') {
    title = 'C/S 전달';
    body = `${name}님 C/S가 전달되었습니다.`;
  }
  return {
    kind: 'cs',
    title,
    body,
    path: staffAppCsPathForRole(params.role),
  };
}

export type DbMarketplacePushVariant =
  | 'listing_published'
  | 'purchase_requested'
  | 'confirmed'
  | 'declined'
  | 'message'
  | 'hold'
  | 'recalled';

export function buildDbMarketplacePushPayload(params: {
  variant: DbMarketplacePushVariant;
  role: string | null | undefined;
  customerName?: string | null;
  listingId?: string | null;
}): StaffAppPushPayload {
  const name = params.customerName?.trim() || '고객';
  const path = staffAppDbMarketplacePathForRole(params.role, params.listingId);
  switch (params.variant) {
    case 'listing_published':
      return { kind: 'db_marketplace', title: '정보공유', body: '새 DB가 등록·변경되었습니다.', path };
    case 'purchase_requested':
      return {
        kind: 'db_marketplace',
        title: 'DB 구매 신청',
        body: `${name} DB 구매 신청이 있습니다.`,
        path,
      };
    case 'confirmed':
      return {
        kind: 'db_marketplace',
        title: 'DB 인계',
        body: `${name} DB 인계가 확정되었습니다.`,
        path,
      };
    case 'declined':
      return { kind: 'db_marketplace', title: 'DB 구매', body: 'DB 구매 신청이 거절되었습니다.', path };
    case 'message':
      return { kind: 'db_marketplace', title: 'DB 문의', body: 'DB Q&A에 새 글이 등록되었습니다.', path };
    case 'hold':
      return { kind: 'db_marketplace', title: 'DB 예약', body: 'DB 예약(hold) 상태가 변경되었습니다.', path };
    case 'recalled':
      return { kind: 'db_marketplace', title: 'DB 회수', body: 'DB가 회수·철회되었습니다.', path };
    default:
      return { kind: 'db_marketplace', title: '정보공유', body: 'DB 정보가 갱신되었습니다.', path };
  }
}
