import { useCallback, useEffect, useState } from 'react';
import {
  fetchQuotationEmailDefaults,
  fetchQuotationEmailLogs,
  resendQuotationEmail,
  sendQuotationEmail,
  type QuotationEmailLogDto,
} from '../../api/quotations';
import { QuotationStatusBadge, qUi } from './quotationUi';

type Props = {
  token: string;
  quotationId: string;
  status: string;
  customerEmail: string;
  sentAt: string | null;
  lastEmailedAt: string | null;
  canEmail: boolean;
  onSent: (patch: {
    status: string;
    customerEmail: string | null;
    sentAt: string | null;
    lastEmailedAt: string | null;
  }) => void;
};

function formatDt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function QuotationEmailPanel({
  token,
  quotationId,
  status,
  customerEmail,
  sentAt,
  lastEmailedAt,
  canEmail,
  onSent,
}: Props) {
  const [emailTo, setEmailTo] = useState(customerEmail);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [logs, setLogs] = useState<QuotationEmailLogDto[]>([]);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sending, setSending] = useState(false);

  const loadDefaults = useCallback(async () => {
    if (!token) return;
    setLoadingDefaults(true);
    try {
      const defaults = await fetchQuotationEmailDefaults(token, quotationId);
      setSubject(defaults.subject);
      setBody(defaults.body);
    } catch {
      /* optional */
    } finally {
      setLoadingDefaults(false);
    }
  }, [token, quotationId]);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    setLoadingLogs(true);
    try {
      const data = await fetchQuotationEmailLogs(token, quotationId);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [token, quotationId]);

  useEffect(() => {
    setEmailTo(customerEmail);
  }, [customerEmail]);

  useEffect(() => {
    void loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function handleSend(resend: boolean) {
    if (!token) return;
    if (!canEmail) {
      alert('SMTP가 설정되지 않았습니다. 업체등록정보에서 메일 설정을 확인해 주세요.');
      return;
    }
    const to = emailTo.trim();
    if (!to) {
      alert('수신 이메일을 입력해 주세요.');
      return;
    }
    setSending(true);
    try {
      const payload = {
        to,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      };
      const updated = resend
        ? await resendQuotationEmail(token, quotationId, payload)
        : await sendQuotationEmail(token, quotationId, payload);
      onSent({
        status: updated.status,
        customerEmail: updated.customerEmail,
        sentAt: updated.sentAt,
        lastEmailedAt: updated.lastEmailedAt,
      });
      await loadLogs();
      alert(resend ? '이메일을 재발송했습니다.' : '이메일을 발송했습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '이메일 발송에 실패했습니다.');
      await loadLogs();
    } finally {
      setSending(false);
    }
  }

  const isSent = status === 'SENT';

  return (
    <section className={`${qUi.cardBody} space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={qUi.sectionTitle}>이메일 발송</h2>
        {isSent && <QuotationStatusBadge status="SENT" />}
      </div>

      {(sentAt || lastEmailedAt) && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-fluid-xs text-slate-600 space-y-0.5">
          {sentAt && <div>최초 발송: {formatDt(sentAt)}</div>}
          {lastEmailedAt && sentAt !== lastEmailedAt && (
            <div>최근 발송: {formatDt(lastEmailedAt)}</div>
          )}
        </div>
      )}

      <label className="block">
        <span className={qUi.label}>수신 이메일</span>
        <input
          type="email"
          className={qUi.input}
          placeholder="수신 이메일"
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
          disabled={!canEmail}
        />
      </label>

      <label className="block">
        <span className={qUi.label}>제목</span>
        <input
          className={qUi.input}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={!canEmail || loadingDefaults}
          placeholder={loadingDefaults ? '불러오는 중…' : undefined}
        />
      </label>

      <label className="block">
        <span className={qUi.label}>본문</span>
        <textarea
          className={qUi.textarea}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!canEmail || loadingDefaults}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sending || !canEmail}
          onClick={() => void handleSend(false)}
          className={qUi.btnSuccess}
          title={!canEmail ? 'SMTP 설정 필요' : undefined}
        >
          {sending ? '발송 중…' : 'PDF 첨부 발송'}
        </button>
        {isSent && (
          <button
            type="button"
            disabled={sending || !canEmail}
            onClick={() => void handleSend(true)}
            className={qUi.btnSecondary}
          >
            재발송
          </button>
        )}
        <button
          type="button"
          disabled={loadingDefaults}
          onClick={() => void loadDefaults()}
          className={qUi.btnGhost}
        >
          기본값 불러오기
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">발송 이력</h3>
        {loadingLogs ? (
          <p className="text-fluid-xs text-slate-500">불러오는 중…</p>
        ) : logs.length === 0 ? (
          <p className="text-fluid-xs text-slate-500">발송 이력이 없습니다.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {logs.map((log) => (
              <li
                key={log.id}
                className={`text-fluid-xs rounded-xl border p-3 ${
                  log.success
                    ? 'border-slate-200/60 bg-slate-50/60'
                    : 'border-rose-200 bg-rose-50/80'
                }`}
              >
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="font-medium text-slate-800 truncate">{log.to}</span>
                  <span className="text-slate-500 shrink-0 tabular-nums">{formatDt(log.sentAt)}</span>
                </div>
                <div className="text-slate-600 mt-0.5 truncate">{log.subject}</div>
                {log.sentBy && (
                  <div className="text-slate-500 mt-0.5">발송: {log.sentBy.name}</div>
                )}
                {!log.success && log.errorMessage && (
                  <div className="text-rose-700 mt-0.5">{log.errorMessage}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
