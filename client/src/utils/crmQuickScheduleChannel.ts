import type { CrmQuickScheduleItem } from '../api/crmQuickSchedule';

export const CRM_QUICK_SCHEDULE_CHANNEL = 'cbiseo-crm-quick-schedule';

export type CrmQuickScheduleChannelMessage =
  | { type: 'apply'; requestId: string; item: CrmQuickScheduleItem; force?: boolean }
  | { type: 'received'; requestId: string }
  | { type: 'applied'; requestId: string; id: string }
  | { type: 'confirm'; requestId: string; id: string }
  | { type: 'failed'; requestId: string; message: string }
  | { type: 'refresh' }
  | { type: 'brand'; operatingCompanyId: string };

const TAB_KEY = 'cbiseo-crm-quick-schedule-tabs';
const TAB_STALE_MS = 8000;

type TabBeat = { focusAt: number; beat: number };

function readQuickScheduleTabs(): Record<string, TabBeat> {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, TabBeat>;
  } catch {
    return {};
  }
}

function writeQuickScheduleTabs(tabs: Record<string, TabBeat>) {
  try {
    localStorage.setItem(TAB_KEY, JSON.stringify(tabs));
  } catch {
    /* 저장 공간이 없으면 이 탭만 응답합니다. */
  }
}

/** 텔레CRM 탭이 살아 있음을 알린다. 포커스된 탭이 불러오기에 응답한다. */
export function noteCrmQuickScheduleTab(tabId: string, focused: boolean) {
  const now = Date.now();
  const tabs = readQuickScheduleTabs();
  const prev = tabs[tabId];
  tabs[tabId] = { focusAt: focused ? now : (prev?.focusAt ?? 0), beat: now };
  for (const [id, row] of Object.entries(tabs)) {
    if (!row || now - row.beat > TAB_STALE_MS) delete tabs[id];
  }
  writeQuickScheduleTabs(tabs);
}

export function forgetCrmQuickScheduleTab(tabId: string) {
  const tabs = readQuickScheduleTabs();
  delete tabs[tabId];
  writeQuickScheduleTabs(tabs);
}

/** 열려 있는 텔레CRM 탭 중 가장 최근에 포커스된 탭만 true */
export function isCrmQuickScheduleResponder(tabId: string): boolean {
  const now = Date.now();
  const alive = Object.entries(readQuickScheduleTabs()).filter(([, row]) => row && now - row.beat <= TAB_STALE_MS);
  if (alive.length === 0) return false;
  alive.sort((a, b) => b[1].focusAt - a[1].focusAt || b[1].beat - a[1].beat);
  return alive[0]?.[0] === tabId;
}

export function postCrmQuickSchedule(message: CrmQuickScheduleChannelMessage): void {
  try {
    const channel = new BroadcastChannel(CRM_QUICK_SCHEDULE_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* 이 브라우저는 창 사이 연결을 지원하지 않습니다. */
  }
}

export function subscribeCrmQuickSchedule(
  onMessage: (message: CrmQuickScheduleChannelMessage) => void,
): () => void {
  try {
    const channel = new BroadcastChannel(CRM_QUICK_SCHEDULE_CHANNEL);
    channel.onmessage = (event: MessageEvent<CrmQuickScheduleChannelMessage>) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      onMessage(data);
    };
    return () => channel.close();
  } catch {
    return () => undefined;
  }
}

export function waitCrmQuickScheduleReply<T extends CrmQuickScheduleChannelMessage['type']>(
  requestId: string,
  types: readonly T[],
  timeoutMs: number,
): Promise<Extract<CrmQuickScheduleChannelMessage, { type: T }> | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Extract<CrmQuickScheduleChannelMessage, { type: T }> | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const unsubscribe = subscribeCrmQuickSchedule((message) => {
      if (!types.includes(message.type as T)) return;
      if (!('requestId' in message) || message.requestId !== requestId) return;
      finish(message as Extract<CrmQuickScheduleChannelMessage, { type: T }>);
    });
    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
}
