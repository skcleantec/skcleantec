import { getOperationNotifyEmails } from '../../lib/operationNotifyEmails.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';

const sentYmd = new Map<string, string>();
const inflight = new Map<string, Promise<void>>();

/** 운영 알림 메일. 같은 날 같은 종류는 한 통. 받는 주소·인증키·전화번호는 로그에 남기지 않는다. */
export async function notifyAlimtalkOpsOnceToday(key: string, subject: string, text: string): Promise<void> {
  const ymd = kstTodayYmd();
  if (sentYmd.get(key) === ymd) return;
  const token = `${key}:${ymd}`;
  const pending = inflight.get(token);
  if (pending) return pending;

  const job = (async () => {
    if (sentYmd.get(key) === ymd) return;
    const emails = await getOperationNotifyEmails();
    if (emails.length === 0) {
      console.info(`[alimtalk-barobill] ops mail skipped ${key}`);
      sentYmd.set(key, ymd);
      return;
    }
    const html = opsMailHtml(text);
    const results = await Promise.all(
      emails.map((to) =>
        sendPlatformMail({ to, subject, text, html }).catch((err) => {
          console.error('[alimtalk-barobill] ops mail', err instanceof Error ? err.name : 'error');
          return { sent: false as const };
        }),
      ),
    );
    if (results.some((row) => row.sent)) {
      sentYmd.set(key, ymd);
      console.info(`[alimtalk-barobill] ops mail ${key} recipients=${emails.length}`);
    }
  })();

  inflight.set(token, job);
  try {
    await job;
  } finally {
    inflight.delete(token);
  }
}

/** 결과 미확정처럼 건마다 다시 보낼 수 있는 운영 메일. 하루 한 번 잠금은 쓰지 않는다. */
export async function sendAlimtalkOpsMail(subject: string, text: string): Promise<boolean> {
  const emails = await getOperationNotifyEmails();
  if (emails.length === 0) {
    console.info('[alimtalk-barobill] ops mail skipped unconfirmed');
    return false;
  }
  const html = opsMailHtml(text);
  const results = await Promise.all(
    emails.map((to) =>
      sendPlatformMail({ to, subject, text, html }).catch((err) => {
        console.error('[alimtalk-barobill] ops mail', err instanceof Error ? err.name : 'error');
        return { sent: false as const };
      }),
    ),
  );
  const sent = results.some((row) => row.sent);
  if (sent) console.info(`[alimtalk-barobill] ops mail unconfirmed recipients=${emails.length}`);
  return sent;
}

function opsMailHtml(text: string): string {
  const escaped = text.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}

export function safeOpsSentence(text: string): string {
  return text.replace(/\d{6,}/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}
