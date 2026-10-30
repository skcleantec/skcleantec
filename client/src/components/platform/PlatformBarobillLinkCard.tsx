import { useState } from 'react';
import type { PlatformBarobillMemberRow } from '../../api/platformBarobill';

const PRIMARY =
  'inline-flex min-h-9 items-center justify-center rounded-lg bg-[#111a2b] px-3 text-fluid-xs font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const GHOST =
  'inline-flex min-h-9 items-center justify-center rounded-lg border border-[#dde3ea] bg-white px-3 text-fluid-xs text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const INPUT =
  'min-h-9 w-full max-w-[220px] rounded-lg border border-[#dde3ea] px-2 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:opacity-50';

function consoleFor(env: string): { label: string; url: string } {
  if (env === 'prod') {
    return { label: '운영서버', url: 'https://dev.barobill.co.kr/console/partners' };
  }
  return { label: '테스트서버', url: 'https://test.barobill.co.kr' };
}

function maskDots(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return '***-**-·····';
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-·····`;
}

function formatCorp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatKstStamp(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}

export function PlatformBarobillLinkCard({
  row,
  busy,
  onComplete,
  onReturn,
}: {
  row: PlatformBarobillMemberRow;
  busy: boolean;
  onComplete: (userId: string) => void;
  onReturn: (reason: string) => void;
}) {
  const [userId, setUserId] = useState(row.linkRequestUserIdHint ?? '');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const shown = maskDots(row.corpNum);
  const consoleTarget = consoleFor(row.env);

  async function copyCorp() {
    try {
      await navigator.clipboard.writeText(formatCorp(row.corpNum));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3 text-left">
      <p className="text-fluid-2xs text-slate-500">
        {formatKstStamp(row.linkRequestedAt)} 요청 · 바로빌 아이디: {row.linkRequestUserIdHint?.trim() || '적지 않음'} · 담당 {row.contactTel || '없음'}
      </p>
      <ol className="list-decimal space-y-3 pl-5 text-fluid-xs text-slate-800">
        <li>
          바로빌 개발자센터 › <b>{consoleTarget.label}</b> › 회원사 관리 › <b>회원사 추가</b>에서 이 사업자를 연결합니다.
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{shown}</span>
            <button type="button" className={GHOST} disabled={busy} onClick={() => void copyCorp()}>
              {copied ? '복사됨' : '사업자번호 복사'}
            </button>
            <a
              className="text-fluid-xs font-medium text-[#1f4fb8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2"
              href={consoleTarget.url}
              target="_blank"
              rel="noreferrer"
            >
              콘솔 열기 ↗
            </a>
          </div>
        </li>
        <li>
          연결된 바로빌 아이디를 넣고 완료합니다. 업체에 완료 메일이 자동으로 갑니다.
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              className={INPUT}
              placeholder="바로빌 아이디"
              value={userId}
              disabled={busy}
              onChange={(e) => setUserId(e.target.value)}
            />
            <button type="button" className={PRIMARY} disabled={busy || userId.trim().length === 0} onClick={() => onComplete(userId.trim())}>
              연결 완료
            </button>
            <button
              type="button"
              className={GHOST}
              disabled={busy || (reasonOpen && reason.trim().length === 0)}
              onClick={() => {
                if (!reasonOpen) {
                  setReasonOpen(true);
                  return;
                }
                onReturn(reason.trim());
              }}
            >
              연결 불가로 돌려보내기
            </button>
          </div>
          {reasonOpen ? (
            <input
              className={`${INPUT} mt-2 max-w-full`}
              placeholder="사유"
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          ) : null}
        </li>
      </ol>
      <p className="text-fluid-2xs text-slate-500">「연결 불가」는 사유를 적어야 하고, 업체 화면에는 사유와 함께 「다시 요청하기」 버튼이 보입니다.</p>
    </div>
  );
}
