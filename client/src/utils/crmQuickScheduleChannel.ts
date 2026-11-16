import type { CrmQuickScheduleItem } from '../api/crmQuickSchedule';

export const CRM_QUICK_SCHEDULE_CHANNEL = 'cbiseo-crm-quick-schedule';

export type CrmQuickScheduleChannelMessage =
  | { type: 'apply'; requestId: string; item: CrmQuickScheduleItem }
  | { type: 'applied'; requestId: string; id: string }
  | { type: 'confirm'; requestId: string; id: string }
  | { type: 'refresh' }
  | { type: 'brand'; operatingCompanyId: string };

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

export function waitCrmQuickScheduleReply(
  requestId: string,
  timeoutMs: number,
): Promise<Extract<CrmQuickScheduleChannelMessage, { type: 'applied' | 'confirm' }> | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Extract<CrmQuickScheduleChannelMessage, { type: 'applied' | 'confirm' }> | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const unsubscribe = subscribeCrmQuickSchedule((message) => {
      if ((message.type === 'applied' || message.type === 'confirm') && message.requestId === requestId) {
        finish(message);
      }
    });
    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
}
