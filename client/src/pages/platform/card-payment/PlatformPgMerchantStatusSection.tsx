import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformPgMerchantStatus,
  patchPlatformPgOnboarding,
  type PgMerchantStage,
  type PgMerchantStatusRow,
} from '../../../api/platformCardPayment';

const STAGE_META: Record<PgMerchantStage, { label: string; className: string }> = {
  NOT_APPLIED: { label: '미신청', className: 'bg-gray-100 text-gray-500' },
  DRAFTING: { label: '작성 중', className: 'bg-gray-100 text-gray-700' },
  SUBMITTED: { label: '신청 접수', className: 'bg-blue-50 text-blue-700' },
  FORWARDED: { label: 'PG 심사 중', className: 'bg-amber-50 text-amber-700' },
  CONTRACT_PENDING: { label: '계약 대기', className: 'bg-amber-50 text-amber-700' },
  CONTRACT_DONE: { label: '계약 완료', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: '반려', className: 'bg-rose-50 text-rose-700' },
};

const FILTERS: { id: 'ALL' | PgMerchantStage; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'NOT_APPLIED', label: '미신청' },
  { id: 'DRAFTING', label: '작성 중' },
  { id: 'SUBMITTED', label: '신청 접수' },
  { id: 'FORWARDED', label: 'PG 심사 중' },
  { id: 'CONTRACT_PENDING', label: '계약 대기' },
  { id: 'CONTRACT_DONE', label: '계약 완료' },
];

function md(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
}

function Done({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {text}
    </span>
  );
}

const Dash = () => <span className="text-gray-300">—</span>;
const Wait = ({ text }: { text: string }) => <span className="text-amber-700">{text}</span>;

function stepCells(r: PgMerchantStatusRow) {
  const s = r.stage;
  const applied = s !== 'NOT_APPLIED' && s !== 'DRAFTING';
  return {
    submitted: r.submittedAt ? (
      <Done text={md(r.submittedAt)} />
    ) : s === 'DRAFTING' ? (
      <span className="text-gray-500">작성 중</span>
    ) : s === 'NOT_APPLIED' ? (
      <span className="text-gray-400">미신청</span>
    ) : (
      <Dash />
    ),
    forwarded: r.forwardedAt ? (
      <Done text={md(r.forwardedAt)} />
    ) : s === 'SUBMITTED' ? (
      <Wait text="전달 전" />
    ) : applied && r.decidedAt ? (
      <span className="text-gray-400">바로 개통</span>
    ) : (
      <Dash />
    ),
    approved:
      s === 'REJECTED' ? (
        <span className="text-rose-600">반려</span>
      ) : (s === 'CONTRACT_PENDING' || s === 'CONTRACT_DONE') && r.decidedAt ? (
        <Done text={md(r.decidedAt)} />
      ) : s === 'FORWARDED' ? (
        <Wait text="심사 중" />
      ) : (
        <Dash />
      ),
    contract: r.contractSignedAt ? (
      <Done text={md(r.contractSignedAt)} />
    ) : s === 'CONTRACT_PENDING' ? (
      <Wait text={r.contractMailedAt ? '우편 발송' : '서명 대기'} />
    ) : (
      <Dash />
    ),
    key: r.keyConnected ? <Done text="연결됨" /> : <Dash />,
  };
}

export function PlatformPgMerchantStatusSection() {
  const [items, setItems] = useState<PgMerchantStatusRow[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | PgMerchantStage>('ALL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await fetchPlatformPgMerchantStatus();
      setItems(d.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (tenantId: string, status: 'FORWARDED_TO_PG' | 'APPROVED' | 'REJECTED', confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await patchPlatformPgOnboarding(tenantId, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const rows = items ?? [];
  const count = (id: 'ALL' | PgMerchantStage) => (id === 'ALL' ? rows.length : rows.filter((r) => r.stage === id).length);
  const rejectedCount = count('REJECTED');
  const list = rows.filter((r) => filter === 'ALL' || r.stage === filter);

  const nextAction = (r: PgMerchantStatusRow) => {
    const name = r.tenant.name;
    const btn = (label: string, onClick: () => void, primary = false) => (
      <button
        key={label}
        type="button"
        disabled={busy}
        onClick={onClick}
        className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
          primary ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {label}
      </button>
    );
    switch (r.stage) {
      case 'SUBMITTED':
        return btn('PG 전달', () => void act(r.tenant.id, 'FORWARDED_TO_PG', `${name} 신청을 PG에 전달했다고 표시할까요?`), true);
      case 'FORWARDED':
        return (
          <span className="inline-flex gap-1.5">
            {btn('개통 처리', () => void act(r.tenant.id, 'APPROVED', `${name}을(를) 개통 처리할까요?`), true)}
            {btn('반려', () => void act(r.tenant.id, 'REJECTED', `${name} 신청을 반려할까요?`))}
          </span>
        );
      case 'CONTRACT_PENDING':
        return <span className="text-xs text-gray-400">업체 서명 대기</span>;
      case 'CONTRACT_DONE':
        return <span className="text-xs text-gray-400">{r.keyConnected ? '완료' : '결제 키 연결 필요'}</span>;
      case 'DRAFTING':
        return <span className="text-xs text-gray-400">업체가 신청서 작성 중</span>;
      case 'REJECTED':
        return <span className="text-xs text-gray-400">반려됨</span>;
      default:
        return <span className="text-xs text-gray-400">{r.keyConnected ? '신청서 없이 키만 연결' : '신청 전'}</span>;
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">가맹점 진행 현황</h2>
        <p className="mt-0.5 text-xs text-gray-500">누가 신청했고, 어디까지 진행됐는지 업체별로 보여요.</p>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-7">
        {FILTERS.map((f) => {
          const n = count(f.id);
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? 'ALL' : f.id)}
              className={`bg-white px-4 py-3 text-left ${active ? 'ring-2 ring-inset ring-gray-900' : 'hover:bg-gray-50'}`}
            >
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${n ? 'text-gray-900' : 'text-gray-300'}`}>{n}</p>
            </button>
          );
        })}
      </div>

      {error ? <p className="px-5 pt-3 text-sm text-rose-600">{error}</p> : null}

      {items == null ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">업체</th>
                  <th className="px-2 py-2.5 text-center font-medium">신청</th>
                  <th className="px-2 py-2.5 text-center font-medium">PG 전달</th>
                  <th className="px-2 py-2.5 text-center font-medium">개통</th>
                  <th className="px-2 py-2.5 text-center font-medium">전자계약</th>
                  <th className="px-2 py-2.5 text-center font-medium">결제 키</th>
                  <th className="px-5 py-2.5 text-right font-medium">다음 할 일</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {list.map((r) => {
                  const c = stepCells(r);
                  const meta = STAGE_META[r.stage];
                  return (
                    <tr key={r.tenant.id} className="border-t border-gray-100">
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{r.tenant.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">{c.submitted}</td>
                      <td className="px-2 py-3 text-center">{c.forwarded}</td>
                      <td className="px-2 py-3 text-center">{c.approved}</td>
                      <td className="px-2 py-3 text-center">{c.contract}</td>
                      <td className="px-2 py-3 text-center">{c.key}</td>
                      <td className="px-5 py-3 text-right">{nextAction(r)}</td>
                    </tr>
                  );
                })}
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      해당하는 업체가 없어요.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 text-sm md:hidden">
            {list.map((r) => {
              const c = stepCells(r);
              const meta = STAGE_META[r.stage];
              const short = (r.stage === 'NOT_APPLIED' || r.stage === 'DRAFTING') && !r.keyConnected;
              return (
                <div key={r.tenant.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">{r.tenant.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>
                  </div>
                  {short ? (
                    <p className="mt-1 text-xs text-gray-400">
                      {r.stage === 'DRAFTING' ? '업체가 신청서 작성 중' : '아직 신청하지 않았어요'}
                    </p>
                  ) : (
                    <>
                      <dl className="mt-2 rounded-lg bg-gray-50 px-3 py-1.5 tabular-nums">
                        {(
                          [
                            ['신청', c.submitted],
                            ['PG 전달', c.forwarded],
                            ['개통', c.approved],
                            ['전자계약', c.contract],
                            ['결제 키', c.key],
                          ] as const
                        ).map(([t, v]) => (
                          <div key={t} className="flex items-center justify-between py-1">
                            <dt className="text-gray-500">{t}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-2 flex justify-end">{nextAction(r)}</div>
                    </>
                  )}
                </div>
              );
            })}
            {list.length === 0 ? <p className="px-4 py-8 text-center text-gray-400">해당하는 업체가 없어요.</p> : null}
          </div>
        </>
      )}

      <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
        개통 후 업체가 전자계약에 서명하면 「계약 완료」로 바뀌어요.
        {rejectedCount > 0 ? ` 반려 ${rejectedCount}곳은 「전체」에서 볼 수 있어요.` : ''}
      </p>
    </section>
  );
}
