import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveOperatingCompanyCancellationPolicy } from '@shared/operatingCompanyCancellationPolicy';
import { SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX } from '@shared/alimtalkScheduleD2Timing';
import { listOperatingCompanies } from '../../api/operatingCompanies';
import { OPERATING_COMPANIES_CANCELLATION_HREF } from '../../constants/operatingCompanyNav';

const INPUT_N =
  'w-20 min-h-9 rounded-lg border border-gray-200 px-2 py-1 text-center tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const LINK_PRIMARY =
  'inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

function brandHasFreeChangeDeadline(policyRaw: unknown): boolean {
  const p = resolveOperatingCompanyCancellationPolicy(policyRaw);
  return p.enabled && p.freeChangeDaysBefore != null && p.freeChangeDaysBefore > 0;
}

export function AlimtalkScheduleD2SendHint(props: {
  token: string | null;
  sendHourLabel: string;
  daysBeforePenalty: string;
  onDaysBeforeChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { token, sendHourLabel, daysBeforePenalty, onDaysBeforeChange, disabled } = props;
  const [missingDeadline, setMissingDeadline] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listOperatingCompanies(token)
      .then((r) => {
        if (cancelled) return;
        const active = r.items.filter((row) => row.isActive);
        const anyDeadline = active.some((row) => brandHasFreeChangeDeadline(row.config.cancellationPolicy));
        setMissingDeadline(active.length === 0 || !anyDeadline);
      })
      .catch(() => {
        if (!cancelled) setMissingDeadline(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <h3 className="text-fluid-xs font-semibold text-gray-900">일정 확인 알림 — 언제 나가나요</h3>
      <p className="text-fluid-2xs text-gray-500 leading-relaxed">
        브랜드에서 정한 <strong className="font-medium text-gray-700">위약 없이 바꿀 수 있는 마지막 날</strong>{' '}
        {sendHourLabel}에 고객에게 나갑니다. 그 날을 정하는 곳은 알림톡이 아니라{' '}
        <strong className="font-medium text-gray-700">영업브랜드 → 위약금</strong>입니다.
      </p>
      <div>
        <Link to={OPERATING_COMPANIES_CANCELLATION_HREF} className={LINK_PRIMARY}>
          브랜드 위약금 설정 바로가기
        </Link>
      </div>
      {missingDeadline ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-amber-900"
          role="status"
        >
          위약 없이 바꿀 수 있는 마지막 날이 없으면 이 알림은 나가지 않습니다. 위 바로가기로 기준일을
          적어 주세요.
        </p>
      ) : null}
      <details className="rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-1.5">
        <summary className="cursor-pointer text-fluid-2xs font-medium text-gray-600 hover:text-gray-800">
          고급 · 발송일을 위약 발생일 기준으로 바꾸기
        </summary>
        <div className="mt-2 space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-fluid-xs text-gray-700">
            위약금 발생일
            <input
              type="number"
              min={0}
              max={SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX}
              className={INPUT_N}
              value={daysBeforePenalty}
              placeholder="기본"
              disabled={disabled}
              onChange={(e) => onDaysBeforeChange(e.target.value)}
            />
            일 전
          </label>
          <p className="text-fluid-2xs text-gray-400 leading-relaxed">
            비워 두면 마지막 날 당일입니다. 숫자를 넣으면 위약금 발생일 기준 N일 전으로 바꿉니다. 0이면
            위약 발생 당일 {sendHourLabel}입니다.
          </p>
        </div>
      </details>
    </div>
  );
}
