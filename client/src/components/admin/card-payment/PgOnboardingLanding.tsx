import { useState } from 'react';
import { LineMdIcon } from '../../ui/LineMdIcon';

const GUIDE_SRC = '/brand/pg-onboarding-guide.jpg';

export type PgConnectionView = '미연결' | '심사중' | '전자계약' | '우편발송' | '코드연결' | '연결됨' | '반려';

const STEPS: Array<{ title: string; body: string; icon: string }> = [
  { title: '가맹신청', body: '구분과 사업자 정보를 적습니다', icon: 'pencil' },
  { title: '가맹 심사완료', body: '제출한 내용을 확인합니다', icon: 'check-list-3' },
  { title: '가맹점 계약서 작성', body: '승인 후 전자계약을 작성합니다', icon: 'document' },
  { title: '계약서 우편발송', body: '작성한 계약서를 우편으로 보냅니다', icon: 'email' },
  { title: '가맹점 코드 연결및 사용', body: '코드가 연결되면 카드 결제를 씁니다', icon: 'circle-to-confirm-circle-transition' },
];

const PILL_CLASS: Record<PgConnectionView, string> = {
  미연결: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  심사중: 'border-white/20 bg-white/10 text-white',
  전자계약: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  우편발송: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  코드연결: 'border-white/20 bg-white/10 text-white',
  연결됨: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  반려: 'border-red-300/40 bg-red-400/15 text-red-100',
};

export function pgConnectionView(
  connected: boolean,
  status: string | undefined,
  contractSignedAt?: string | null,
  contractMailedAt?: string | null,
): PgConnectionView {
  if (status === 'REJECTED') return '반려';
  if (connected) return '연결됨';
  if (status === 'APPROVED' && !contractSignedAt) return '전자계약';
  if (status === 'APPROVED' && contractSignedAt && !contractMailedAt) return '우편발송';
  if (status === 'APPROVED' && contractSignedAt && contractMailedAt) return '코드연결';
  if (status === 'SUBMITTED' || status === 'FORWARDED_TO_PG') return '심사중';
  return '미연결';
}

export function canOpenPgApplication(view: PgConnectionView): boolean {
  return view === '미연결' || view === '반려';
}

function stepIndex(view: PgConnectionView): number {
  if (view === '연결됨') return 5;
  if (view === '코드연결') return 4;
  if (view === '우편발송') return 3;
  if (view === '전자계약') return 2;
  if (view === '심사중') return 1;
  return 0;
}

export function PgGuideBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <img
      src={GUIDE_SRC}
      alt="원성페이먼츠 PG 연동 안내"
      width={571}
      height={1024}
      className="mx-auto block h-auto w-auto max-w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
      onError={() => setHidden(true)}
    />
  );
}

export function PgOnboardingSteps({ view, compact = false }: { view: PgConnectionView; compact?: boolean }) {
  const current = stepIndex(view);
  return (
    <ol className={`grid grid-cols-2 sm:grid-cols-5 ${compact ? 'gap-1' : 'gap-2'}`}>
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.title} className="min-w-0 text-center">
            <span
              className={[
                'mx-auto flex items-center justify-center rounded-full',
                compact ? 'size-8' : 'size-10',
                done
                  ? 'bg-emerald-600 text-white'
                  : active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              <LineMdIcon name={done ? 'circle-to-confirm-circle-transition' : step.icon} className={compact ? 'size-4' : 'size-5'} />
            </span>
            <p className={`mt-1.5 font-medium ${active ? 'text-slate-900' : 'text-slate-600'} ${compact ? 'text-fluid-2xs' : 'text-fluid-xs'}`}>
              {step.title}
            </p>
            {compact ? null : <p className="mt-0.5 text-fluid-2xs leading-snug text-slate-500">{step.body}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function PgApplyButton({ onApply }: { onApply: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-14 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-fluid-base font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      onClick={onApply}
    >
      PG 신청하기
    </button>
  );
}

export function PgOnboardingLanding({
  view,
  detail,
  onApply,
  onContract,
  onMailed,
}: {
  view: PgConnectionView;
  detail: string | null;
  onApply: () => void;
  onContract?: () => void;
  onMailed?: () => void;
}) {
  const canApply = canOpenPgApplication(view);
  return (
    <div>
      <div className="bg-slate-900 px-4 py-4 text-white sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-fluid-2xs text-slate-300">카드 결제</p>
            <p className="mt-0.5 text-fluid-base font-semibold">원성페이먼츠 PG</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-fluid-2xs font-medium ${PILL_CLASS[view]}`}>
            {view}
          </span>
        </div>
        <p className="mt-3 max-w-lg text-fluid-xs leading-relaxed text-slate-300">
          {detail ?? '손님 카드 결제를 받으려면 PG 연결이 필요합니다.'}
        </p>
        {canApply ? (
          <button
            type="button"
            className="mt-4 flex min-h-14 w-full items-center justify-center rounded-xl bg-white px-5 text-fluid-base font-semibold text-slate-900 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50"
            onClick={onApply}
          >
            PG 신청하기
          </button>
        ) : null}
        {view === '전자계약' && onContract ? (
          <button
            type="button"
            className="mt-4 flex min-h-14 w-full items-center justify-center rounded-xl bg-white px-5 text-fluid-base font-semibold text-slate-900 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={onContract}
          >
            전자계약 작성
          </button>
        ) : null}
        {view === '우편발송' && onMailed ? (
          <button
            type="button"
            className="mt-4 flex min-h-14 w-full items-center justify-center rounded-xl bg-white px-5 text-fluid-base font-semibold text-slate-900 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={onMailed}
          >
            계약서를 우편으로 보냈습니다
          </button>
        ) : null}
      </div>
      <div className="px-3 pt-4 sm:px-5">
        <PgGuideBanner />
      </div>
      <div className="space-y-4 px-3 py-4 sm:px-5">
        <PgOnboardingSteps view={view} />
        {canApply ? <PgApplyButton onApply={onApply} /> : null}
        {view === '전자계약' && onContract ? (
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-fluid-base font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={onContract}
          >
            전자계약 작성
          </button>
        ) : null}
        {view === '우편발송' && onMailed ? (
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-fluid-base font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={onMailed}
          >
            계약서를 우편으로 보냈습니다
          </button>
        ) : null}
      </div>
    </div>
  );
}
