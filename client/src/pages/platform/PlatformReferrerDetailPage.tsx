import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchPlatformReferrer,
  listPlatformReferrerCommissions,
  listPlatformReferrerSignups,
  updatePlatformReferrer,
  updatePlatformReferrerCommissionStatus,
  usePlatformTokenOrThrow,
  type PlatformReferrerCommissionRow,
  type PlatformReferrerDetail,
  type PlatformReferrerSignupRow,
} from '../../api/platformReferrers';
import {
  PLATFORM_REFERRER_COMMISSION_STATUS_LABEL,
  PLATFORM_REFERRER_STATUS_LABEL,
  PLATFORM_REFERRER_TYPE_LABEL,
} from '@shared/platformReferral';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

function formatKo(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatWon(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function PlatformReferrerDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'overview' | 'signups' | 'commissions'>('overview');
  const [item, setItem] = useState<PlatformReferrerDetail | null>(null);
  const [signups, setSignups] = useState<PlatformReferrerSignupRow[]>([]);
  const [commissions, setCommissions] = useState<PlatformReferrerCommissionRow[]>([]);
  const [selectedAccrualIds, setSelectedAccrualIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('5');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const detail = await fetchPlatformReferrer(token, id);
      setItem(detail);
      setCommissionPercent(String(detail.commissionRateBps / 100));
      setStatus(detail.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSignups = useCallback(async () => {
    if (!id) return;
    try {
      const token = usePlatformTokenOrThrow();
      const data = await listPlatformReferrerSignups(token, id);
      setSignups(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '가입 목록 조회 실패');
    }
  }, [id]);

  const loadCommissions = useCallback(async () => {
    if (!id) return;
    try {
      const token = usePlatformTokenOrThrow();
      const data = await listPlatformReferrerCommissions(token, id, { limit: 100 });
      setCommissions(data.items);
      setSelectedAccrualIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수수료 조회 실패');
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (tab === 'signups') void loadSignups();
    if (tab === 'commissions') void loadCommissions();
  }, [tab, loadSignups, loadCommissions]);

  const copyLink = async () => {
    if (!item?.signupLink) return;
    try {
      await navigator.clipboard.writeText(item.signupLink);
      setInfo('가입 링크를 복사했습니다.');
    } catch {
      setError('링크 복사에 실패했습니다.');
    }
  };

  const saveSettings = async () => {
    if (!id || !item) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const token = usePlatformTokenOrThrow();
      const pct = Number(commissionPercent);
      const updated = await updatePlatformReferrer(token, id, {
        commissionRateBps: Number.isFinite(pct) ? Math.round(pct * 100) : item.commissionRateBps,
        status,
      });
      setItem({ ...item, ...updated, signupLink: item.signupLink });
      setInfo('저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const markCommissions = async (nextStatus: 'APPROVED' | 'PAID') => {
    if (!id || selectedAccrualIds.length === 0) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const token = usePlatformTokenOrThrow();
      await updatePlatformReferrerCommissionStatus(token, id, {
        accrualIds: selectedAccrualIds,
        status: nextStatus,
      });
      setInfo(`${selectedAccrualIds.length}건을 ${PLATFORM_REFERRER_COMMISSION_STATUS_LABEL[nextStatus]} 처리했습니다.`);
      await Promise.all([loadCommissions(), loadDetail()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !item) {
    return <p className="py-10 text-center text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  if (!item) {
    return <p className="py-10 text-center text-fluid-sm text-red-600">{error || '추천인을 찾을 수 없습니다.'}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 min-w-0">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-fluid-sm text-slate-500">
          <Link to="/platform/referrers" className="hover:text-slate-800">
            추천인
          </Link>
          <span>/</span>
          <span className="text-slate-900">{item.displayName}</span>
        </div>
        <h1 className="mt-2 text-fluid-lg font-semibold text-slate-900">{item.displayName}</h1>
        <p className="mt-1 text-fluid-xs text-slate-500">
          코드 <span className="font-mono">{item.code}</span> · {PLATFORM_REFERRER_TYPE_LABEL[item.type]} ·{' '}
          {PLATFORM_REFERRER_STATUS_LABEL[item.status]}
        </p>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">{error}</p> : null}
      {info ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-700">{info}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(['overview', 'signups', 'commissions'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-fluid-xs font-semibold ${
              tab === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() => setTab(key)}
          >
            {key === 'overview' ? '개요' : key === 'signups' ? '가입 목록' : '수수료'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`${CARD_SECTION} space-y-3`}>
            <h2 className="text-fluid-sm font-semibold text-slate-900">가입 링크</h2>
            <p className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-fluid-2xs">{item.signupLink}</p>
            <button type="button" className={BTN_SECONDARY} onClick={() => void copyLink()}>
              링크 복사
            </button>
            <dl className="grid grid-cols-2 gap-2 text-fluid-xs">
              <dt className="text-slate-500">가입 수</dt>
              <dd className="text-right tabular-nums">{item.signupCount}</dd>
              <dt className="text-slate-500">유료 업체</dt>
              <dd className="text-right tabular-nums">{item.paidTenantCount}</dd>
              <dt className="text-slate-500">미지급 수수료</dt>
              <dd className="text-right tabular-nums">{formatWon(item.pendingCommissionKrw)}</dd>
              <dt className="text-slate-500">지급 완료</dt>
              <dd className="text-right tabular-nums">{formatWon(item.paidCommissionKrw)}</dd>
            </dl>
          </section>

          <section className={`${CARD_SECTION} space-y-3`}>
            <h2 className="text-fluid-sm font-semibold text-slate-900">설정</h2>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">수수료율 (%)</span>
              <input value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className={INPUT_BASE} />
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">상태</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')} className={INPUT_BASE}>
                <option value="ACTIVE">활성</option>
                <option value="SUSPENDED">중지</option>
              </select>
            </label>
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void saveSettings()}>
              저장
            </button>
          </section>
        </div>
      ) : null}

      {tab === 'signups' ? (
        <section className={CARD_SECTION}>
          {signups.length === 0 ? (
            <p className="py-8 text-center text-fluid-sm text-slate-500">가입 실적이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-fluid-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 text-center">업체</th>
                    <th className="px-2 py-2 text-center">플랜</th>
                    <th className="px-2 py-2 text-center">가입일</th>
                    <th className="px-2 py-2 text-center">유료 청구</th>
                    <th className="px-2 py-2 text-center">적립 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-center">
                        <Link to={`/platform/tenants/${row.tenant.id}`} className="text-blue-700 hover:underline">
                          {row.tenant.name}
                        </Link>
                        <div className="font-mono text-fluid-2xs text-slate-500">{row.tenant.slug}</div>
                      </td>
                      <td className="px-2 py-2 text-center">{row.tenant.plan}</td>
                      <td className="px-2 py-2 text-center">{formatKo(row.attributedAt)}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{row.paidInvoiceCount}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{formatWon(row.totalCommissionKrw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'commissions' ? (
        <section className={`${CARD_SECTION} space-y-3`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={busy || selectedAccrualIds.length === 0}
              onClick={() => void markCommissions('APPROVED')}
            >
              선택 승인
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={busy || selectedAccrualIds.length === 0}
              onClick={() => void markCommissions('PAID')}
            >
              선택 지급완료
            </button>
          </div>
          {commissions.length === 0 ? (
            <p className="py-8 text-center text-fluid-sm text-slate-500">수수료 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-fluid-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-2 py-2 text-center">선택</th>
                    <th className="px-2 py-2 text-center">업체</th>
                    <th className="px-2 py-2 text-center">청구월</th>
                    <th className="px-2 py-2 text-center">납부액</th>
                    <th className="px-2 py-2 text-center">수수료</th>
                    <th className="px-2 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedAccrualIds.includes(row.id)}
                          disabled={row.status === 'PAID' || row.status === 'REVERSED'}
                          onChange={(e) => {
                            setSelectedAccrualIds((prev) =>
                              e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                            );
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.tenant.name}
                        <div className="font-mono text-fluid-2xs text-slate-500">{row.tenant.slug}</div>
                      </td>
                      <td className="px-2 py-2 text-center">{row.periodYm}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{formatWon(row.invoicePaidAmount)}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{formatWon(row.commissionAmount)}</td>
                      <td className="px-2 py-2 text-center">{PLATFORM_REFERRER_COMMISSION_STATUS_LABEL[row.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
