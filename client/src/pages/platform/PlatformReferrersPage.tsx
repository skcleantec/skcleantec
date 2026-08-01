import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPlatformTenants, type PlatformTenantRow } from '../../api/platformTenants';
import {
  createPlatformReferrer,
  listPlatformReferrers,
  usePlatformTokenOrThrow,
  type PlatformReferrerListItem,
} from '../../api/platformReferrers';
import { PlatformTenantSelect } from '../../components/platform/PlatformTenantSelect';
import { buildReferrerSignupLinks } from '@shared/platformReferral';
import {
  PLATFORM_REFERRER_DEFAULT_COMMISSION_RATE_BPS,
  PLATFORM_REFERRER_STATUS_LABEL,
  PLATFORM_REFERRER_TYPE_LABEL,
} from '@shared/platformReferral';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

function formatWon(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function PlatformReferrersPage() {
  const [items, setItems] = useState<PlatformReferrerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<'INDIVIDUAL' | 'PARTNER'>('INDIVIDUAL');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('5');
  const [partnerTenantId, setPartnerTenantId] = useState('');
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [memo, setMemo] = useState('');

  const previewLinks = useMemo(() => {
    const trimmed = code.trim().toLowerCase();
    if (trimmed.length < 2) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.cbiseo.com';
    return buildReferrerSignupLinks(trimmed, origin);
  }, [code]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const data = await listPlatformReferrers(token, { q: q.trim() || undefined });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showCreate || type !== 'PARTNER') return;
    let cancelled = false;
    setTenantsLoading(true);
    void (async () => {
      try {
        const token = usePlatformTokenOrThrow();
        const items = await listPlatformTenants(token);
        if (!cancelled) setTenants(items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '업체 목록을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setTenantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showCreate, type]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const pct = Number(commissionPercent);
      const commissionRateBps = Number.isFinite(pct)
        ? Math.round(pct * 100)
        : PLATFORM_REFERRER_DEFAULT_COMMISSION_RATE_BPS;
      const item = await createPlatformReferrer(token, {
        type,
        code,
        displayName,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        partnerTenantId: type === 'PARTNER' ? partnerTenantId.trim() || null : null,
        commissionRateBps,
        memo: memo.trim() || null,
      });
      setShowCreate(false);
      setCode('');
      setDisplayName('');
      setContactEmail('');
      setContactPhone('');
      setPartnerTenantId('');
      setMemo('');
      setCommissionPercent('5');
      setType('INDIVIDUAL');
      await load();
      window.location.assign(`/platform/referrers/${item.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-fluid-lg font-semibold text-slate-900">추천인 관리</h1>
          <p className="mt-1 text-fluid-xs text-slate-500">
            셀프 가입 추천 코드·가입 실적·유료 청구 수수료를 관리합니다. 기본 수수료율 5%.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? '등록 닫기' : '새 추천인'}
        </button>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-700">{error}</p> : null}

      {showCreate ? (
        <form onSubmit={handleCreate} className={`${CARD_SECTION} space-y-4`}>
          <h2 className="text-fluid-sm font-semibold text-slate-900">추천인 등록</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">유형</span>
              <select value={type} onChange={(e) => setType(e.target.value as 'INDIVIDUAL' | 'PARTNER')} className={INPUT_BASE}>
                <option value="INDIVIDUAL">개인</option>
                <option value="PARTNER">파트너 업체</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">추천 코드</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                className={`${INPUT_BASE} font-mono`}
                placeholder="예: acme-intro"
                required
              />
              <p className="mt-1 text-fluid-2xs text-slate-500">
                가입 링크에 쓰입니다. 업체 로그인 코드와 같을 필요는 없습니다.
              </p>
              {previewLinks ? (
                <p className="mt-1 font-mono text-fluid-2xs text-sky-800">
                  미리보기: {previewLinks.shortLink}
                </p>
              ) : null}
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-fluid-xs text-slate-600">표시 이름</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={INPUT_BASE} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">연락 이메일</span>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={INPUT_BASE} />
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">연락 전화</span>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={INPUT_BASE} />
            </label>
            <label className="block">
              <span className="mb-1 block text-fluid-xs text-slate-600">수수료율 (%)</span>
              <input
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className={INPUT_BASE}
                inputMode="decimal"
                required
              />
            </label>
            {type === 'PARTNER' ? (
              <label className="block">
                <span className="mb-1 block text-fluid-xs text-slate-600">연결 업체</span>
                <PlatformTenantSelect
                  value={partnerTenantId}
                  onChange={setPartnerTenantId}
                  tenants={tenants}
                  loading={tenantsLoading}
                  required
                />
              </label>
            ) : null}
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-fluid-xs text-slate-600">메모</span>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className={INPUT_BASE} rows={2} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={creating}>
              {creating ? '등록 중…' : '등록'}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setShowCreate(false)}>
              취소
            </button>
          </div>
        </form>
      ) : null}

      <div className={`${CARD_SECTION} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="코드·이름 검색"
            className={`${INPUT_BASE} max-w-xs`}
          />
          <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
            조회
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-fluid-sm text-slate-500">등록된 추천인이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-fluid-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-2 py-2 text-center">이름</th>
                  <th className="px-2 py-2 text-center">코드</th>
                  <th className="px-2 py-2 text-center">유형</th>
                  <th className="px-2 py-2 text-center">수수료</th>
                  <th className="px-2 py-2 text-center">가입</th>
                  <th className="px-2 py-2 text-center">유료 업체</th>
                  <th className="px-2 py-2 text-center">미지급</th>
                  <th className="px-2 py-2 text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-2 py-2 text-center">
                      <Link to={`/platform/referrers/${row.id}`} className="font-medium text-blue-700 hover:underline">
                        {row.displayName}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-center font-mono">{row.code}</td>
                    <td className="px-2 py-2 text-center">{PLATFORM_REFERRER_TYPE_LABEL[row.type]}</td>
                    <td className="px-2 py-2 text-center">{row.commissionRateLabel}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.signupCount}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.paidTenantCount}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{formatWon(row.pendingCommissionKrw)}</td>
                    <td className="px-2 py-2 text-center">{PLATFORM_REFERRER_STATUS_LABEL[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
