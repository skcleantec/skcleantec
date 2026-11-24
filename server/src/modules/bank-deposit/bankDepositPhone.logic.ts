/** 입금 알림 폰이 heartbeat 로 보내는 상태. 화면 판단과 알림 제한은 여기서만 한다. */

export const PHONE_ALERT_PUSH_TEXT = '사업자폰이 입금 알림을 못 받고 있어요';
const HOUR_MS = 60 * 60 * 1000;
const LISTENER_DOWN_MS = 3 * 60 * 1000;
const COUNTER_KEYS = ['posts', 'extracted', 'deposits', 'missed', 'rebinds', 'sent'] as const;

export type PhoneAlertCode = 'NOT_LISTENING' | 'NO_ACCESS' | 'KEEPALIVE_OFF' | 'SILENT' | 'OLD_APP';

export type PhoneAlert = {
  level: 'error' | 'warn';
  code: PhoneAlertCode;
  since: string;
};

export type HeartbeatPrevious = {
  listenerDownSince: Date | null;
  noticeOffSince: Date | null;
  keepAliveOffSince: Date | null;
};

export type HeartbeatWrite = {
  appVersion?: string;
  listenerConnected?: boolean;
  noticeAccessEnabled?: boolean;
  keepAliveRunning?: boolean;
  batteryUnrestricted?: boolean;
  lastNoticeAt?: Date | null;
  counters?: Record<string, number>;
  statusAt?: Date;
  listenerDownSince?: Date | null;
  noticeOffSince?: Date | null;
  keepAliveOffSince?: Date | null;
};

export type PhoneDevice = HeartbeatPrevious & {
  id: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  statusAt: Date | null;
  listenerConnected: boolean | null;
  noticeAccessEnabled: boolean | null;
  keepAliveRunning: boolean | null;
  alertPushCode: string | null;
  alertPushAt: Date | null;
};

const RANK: Record<PhoneAlertCode, number> = {
  NOT_LISTENING: 0,
  NO_ACCESS: 1,
  SILENT: 2,
  KEEPALIVE_OFF: 3,
  OLD_APP: 4,
};

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function readNoticeAt(value: unknown): Date | null | undefined {
  if (value == null || value === 0 || value === '0' || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return null;
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

/** 없는 칸은 빼 둔다. "{}" 는 빈 객체. 상태 칸이 있으면 statusAt 을 지금으로 둔다. */
export function heartbeatWrite(body: unknown, previous: HeartbeatPrevious, now: Date): HeartbeatWrite {
  const raw = asRecord(body);
  if (!raw) return {};
  const write: HeartbeatWrite = {};
  if (typeof raw.appVersion === 'string') {
    const version = raw.appVersion.trim().slice(0, 40);
    if (version) write.appVersion = version;
  }
  let hasStatus = false;
  if (typeof raw.listenerConnected === 'boolean') {
    write.listenerConnected = raw.listenerConnected;
    write.listenerDownSince = raw.listenerConnected ? null : (previous.listenerDownSince ?? now);
    hasStatus = true;
  }
  if (typeof raw.noticeAccessEnabled === 'boolean') {
    write.noticeAccessEnabled = raw.noticeAccessEnabled;
    write.noticeOffSince = raw.noticeAccessEnabled ? null : (previous.noticeOffSince ?? now);
    hasStatus = true;
  }
  if (typeof raw.keepAliveRunning === 'boolean') {
    write.keepAliveRunning = raw.keepAliveRunning;
    write.keepAliveOffSince = raw.keepAliveRunning ? null : (previous.keepAliveOffSince ?? now);
    hasStatus = true;
  }
  if (typeof raw.batteryUnrestricted === 'boolean') {
    write.batteryUnrestricted = raw.batteryUnrestricted;
    hasStatus = true;
  }
  if ('lastNoticeAt' in raw) {
    const at = readNoticeAt(raw.lastNoticeAt);
    if (at !== undefined) {
      write.lastNoticeAt = at;
      hasStatus = true;
    }
  }
  if (raw.counters && typeof raw.counters === 'object' && !Array.isArray(raw.counters)) {
    const counters: Record<string, number> = {};
    const bag = raw.counters as Record<string, unknown>;
    for (const key of COUNTER_KEYS) {
      const value = bag[key];
      if (typeof value === 'number' && Number.isFinite(value)) counters[key] = value;
    }
    write.counters = counters;
    hasStatus = true;
  }
  if (hasStatus) write.statusAt = now;
  return write;
}

/** 화면과 같이, 마지막 신호가 20분을 넘긴 뒤(21분째)부터 끊긴 것으로 본다. */
export function phoneIsSilent(lastSeenAt: Date | null, now: Date): boolean {
  if (!lastSeenAt) return true;
  const diffMin = Math.floor((now.getTime() - lastSeenAt.getTime()) / 60_000);
  return diffMin > 20;
}

function alertsForDevice(device: PhoneDevice, now: Date): PhoneAlert[] {
  if (phoneIsSilent(device.lastSeenAt, now)) {
    const since = device.lastSeenAt
      ? new Date(device.lastSeenAt.getTime() + 21 * 60_000)
      : device.createdAt;
    return [{ level: 'error', code: 'SILENT', since: since.toISOString() }];
  }
  if (!device.statusAt) {
    return [{ level: 'warn', code: 'OLD_APP', since: device.createdAt.toISOString() }];
  }
  const found: PhoneAlert[] = [];
  if (device.listenerConnected === false) {
    const since = device.listenerDownSince ?? device.statusAt;
    if (now.getTime() - since.getTime() > LISTENER_DOWN_MS) {
      found.push({ level: 'error', code: 'NOT_LISTENING', since: since.toISOString() });
    }
  }
  if (device.noticeAccessEnabled === false) {
    const since = device.noticeOffSince ?? device.statusAt;
    found.push({ level: 'error', code: 'NO_ACCESS', since: since.toISOString() });
  }
  if (device.keepAliveRunning === false) {
    const since = device.keepAliveOffSince ?? device.statusAt;
    found.push({ level: 'warn', code: 'KEEPALIVE_OFF', since: since.toISOString() });
  }
  return found;
}

/** 연결된 기기 중 가장 급한 문제 하나. 없으면 null. */
export function pickPhoneAlert(devices: PhoneDevice[], now: Date): { alert: PhoneAlert | null; deviceId: string | null } {
  let best: { alert: PhoneAlert; deviceId: string } | null = null;
  for (const device of devices) {
    for (const alert of alertsForDevice(device, now)) {
      if (!best || RANK[alert.code] < RANK[best.alert.code]) best = { alert, deviceId: device.id };
    }
  }
  return { alert: best?.alert ?? null, deviceId: best?.deviceId ?? null };
}

/** error 가 되었고, 같은 코드로는 한 시간이 지났을 때만. */
export function shouldSendPhoneAlert(
  devices: Pick<PhoneDevice, 'alertPushCode' | 'alertPushAt'>[],
  alert: PhoneAlert | null,
  now: Date,
): boolean {
  if (!alert || alert.level !== 'error') return false;
  const recent = devices.some(
    (device) =>
      device.alertPushCode === alert.code &&
      device.alertPushAt != null &&
      now.getTime() - device.alertPushAt.getTime() < HOUR_MS,
  );
  return !recent;
}
