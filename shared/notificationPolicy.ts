/** 테넌트·사용자 알림 정책 — `StaffAppPushKind` 와 동기화 */

import type { StaffAppPushKind } from './staffAppPush';

export const NOTIFICATION_KIND_ORDER: StaffAppPushKind[] = [
  'assignment',
  'schedule_alert',
  'order_form_submit',
  'happy_call',
  'message',
  'cs',
  'db_marketplace',
  'generic',
];

export const NOTIFICATION_KIND_LABELS: Record<StaffAppPushKind, string> = {
  assignment: '접수 배정',
  schedule_alert: '일정·금액·취소',
  order_form_submit: '발주서 접수',
  happy_call: '해피콜',
  message: '1:1 메시지',
  cs: 'C/S',
  db_marketplace: '정보공유(DB)',
  generic: '기타 알림',
};

export const NOTIFICATION_KIND_DESCRIPTIONS: Record<StaffAppPushKind, string> = {
  assignment: '접수가 팀장에게 배정·재배정될 때',
  schedule_alert: '접수 일정 변경·예약 취소 시 (마케터·관리자 전원)',
  order_form_submit: '고객이 발주서를 제출해 접수될 때',
  happy_call: '청소일 전날 18:00(KST)부터 미완 시 매시간 알림(완료까지)',
  message: '관리·팀 간 1:1 메시지 수신 시',
  cs: 'C/S 접수·상태 변경 시',
  db_marketplace: '정보공유(DB) 인계·승인 등',
  generic: '위 유형에 해당하지 않는 갱신 알림',
};

/** 테넌트(관리자) — 종류별 규칙 */
export type NotificationKindRule = {
  /** 테넌트에서 이 종류 알림 사용 */
  enabled: boolean;
  /** 팀장이 앱 푸시를 끌 수 없음 */
  mandatory: boolean;
  /** 신규 사용자 기본 푸시 on */
  defaultPush: boolean;
  /** 마감·미완 등 반복 푸시 (해피콜 등) */
  repeatEnabled: boolean;
  /** 반복 간격(분) — overdue 등 */
  repeatIntervalMinutes: number;
  /** 접수(inquiry)당 최대 반복 횟수 */
  repeatMaxPerInquiry: number;
  /** 해피콜: (레거시 UI) 마감 전 N분 알림 — 현재 cron은 전날 18:00부터 시간당 1회 */
  remindBeforeDeadlineMinutes: number[];
};

export type TenantNotificationPolicyDto = {
  kinds: Record<StaffAppPushKind, NotificationKindRule>;
};

export type UserNotificationKindPref = {
  push: boolean;
};

export type UserNotificationPreferencesDto = {
  kinds: Partial<Record<StaffAppPushKind, UserNotificationKindPref>>;
};

function defaultKindRule(kind: StaffAppPushKind): NotificationKindRule {
  const base: NotificationKindRule = {
    enabled: true,
    mandatory: kind === 'assignment' || kind === 'schedule_alert' || kind === 'happy_call',
    defaultPush: true,
    repeatEnabled: false,
    repeatIntervalMinutes: 60,
    repeatMaxPerInquiry: 3,
    remindBeforeDeadlineMinutes: [],
  };
  if (kind === 'happy_call') {
    return {
      ...base,
      mandatory: true,
      repeatEnabled: true,
      repeatIntervalMinutes: 60,
      repeatMaxPerInquiry: 24,
      remindBeforeDeadlineMinutes: [],
    };
  }
  if (kind === 'generic') {
    return { ...base, mandatory: false, defaultPush: true, enabled: true };
  }
  if (kind === 'assignment' || kind === 'schedule_alert') {
    return { ...base, mandatory: true, repeatEnabled: false };
  }
  return base;
}

export function defaultTenantNotificationPolicy(): TenantNotificationPolicyDto {
  const kinds = {} as Record<StaffAppPushKind, NotificationKindRule>;
  for (const k of NOTIFICATION_KIND_ORDER) {
    kinds[k] = defaultKindRule(k);
  }
  return { kinds };
}

export function shouldSendPushToUser(
  kind: StaffAppPushKind,
  tenantPolicy: TenantNotificationPolicyDto,
  userPref: UserNotificationPreferencesDto | null | undefined,
): boolean {
  const rule = tenantPolicy.kinds[kind];
  if (!rule?.enabled) return false;
  if (rule.mandatory) return true;
  const userKind = userPref?.kinds?.[kind];
  if (userKind?.push === false) return false;
  if (userKind?.push === true) return true;
  return rule.defaultPush;
}

export function mergeTenantNotificationPolicy(
  raw: unknown,
): TenantNotificationPolicyDto {
  const defaults = defaultTenantNotificationPolicy();
  if (!raw || typeof raw !== 'object') return defaults;
  const o = raw as { kinds?: unknown };
  if (!o.kinds || typeof o.kinds !== 'object') return defaults;
  const src = o.kinds as Record<string, unknown>;
  const kinds = { ...defaults.kinds };
  for (const k of NOTIFICATION_KIND_ORDER) {
    const row = src[k];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    kinds[k] = {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : kinds[k].enabled,
      mandatory: typeof r.mandatory === 'boolean' ? r.mandatory : kinds[k].mandatory,
      defaultPush: typeof r.defaultPush === 'boolean' ? r.defaultPush : kinds[k].defaultPush,
      repeatEnabled: typeof r.repeatEnabled === 'boolean' ? r.repeatEnabled : kinds[k].repeatEnabled,
      repeatIntervalMinutes:
        typeof r.repeatIntervalMinutes === 'number' && r.repeatIntervalMinutes >= 5
          ? Math.round(r.repeatIntervalMinutes)
          : kinds[k].repeatIntervalMinutes,
      repeatMaxPerInquiry:
        typeof r.repeatMaxPerInquiry === 'number' && r.repeatMaxPerInquiry >= 0
          ? Math.round(r.repeatMaxPerInquiry)
          : kinds[k].repeatMaxPerInquiry,
      remindBeforeDeadlineMinutes: Array.isArray(r.remindBeforeDeadlineMinutes)
        ? r.remindBeforeDeadlineMinutes
            .filter((x): x is number => typeof x === 'number' && x > 0)
            .map((x) => Math.round(x))
            .sort((a, b) => b - a)
        : kinds[k].remindBeforeDeadlineMinutes,
    };
    if (kinds[k].mandatory) {
      kinds[k].defaultPush = true;
    }
  }
  return { kinds };
}

export function mergeUserNotificationPreferences(
  raw: unknown,
): UserNotificationPreferencesDto {
  if (!raw || typeof raw !== 'object') return { kinds: {} };
  const o = raw as { kinds?: unknown };
  if (!o.kinds || typeof o.kinds !== 'object') return { kinds: {} };
  const src = o.kinds as Record<string, unknown>;
  const kinds: UserNotificationPreferencesDto['kinds'] = {};
  for (const k of NOTIFICATION_KIND_ORDER) {
    const row = src[k];
    if (!row || typeof row !== 'object') continue;
    const push = (row as { push?: unknown }).push;
    if (typeof push === 'boolean') {
      kinds[k] = { push };
    }
  }
  return { kinds };
}

/** 팀장 UI — 테넌트에서 켜진 종류만, mandatory 여부 포함 */
export function buildTeamNotificationSettingsView(
  tenantPolicy: TenantNotificationPolicyDto,
  userPref: UserNotificationPreferencesDto,
): Array<{
  kind: StaffAppPushKind;
  label: string;
  description: string;
  mandatory: boolean;
  push: boolean;
  canToggle: boolean;
}> {
  return NOTIFICATION_KIND_ORDER.filter((k) => tenantPolicy.kinds[k]?.enabled).map((kind) => {
    const rule = tenantPolicy.kinds[kind];
    const mandatory = Boolean(rule?.mandatory);
    const push = shouldSendPushToUser(kind, tenantPolicy, userPref);
    return {
      kind,
      label: NOTIFICATION_KIND_LABELS[kind],
      description: NOTIFICATION_KIND_DESCRIPTIONS[kind],
      mandatory,
      push,
      canToggle: !mandatory,
    };
  });
}
