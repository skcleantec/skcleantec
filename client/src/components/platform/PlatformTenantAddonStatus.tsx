import { useEffect, useState } from 'react';
import { BAROBILL_MEMBER_STATUS_LABEL } from '@shared/barobillPolicy';
import { fetchPlatformBarobillMembers, type PlatformBarobillMemberRow } from '../../api/platformBarobill';
import { fetchPlatformPgOnboardings, fetchPlatformTenantCredential } from '../../api/platformCardPayment';

export type TenantAddonSnapshot = {
  loading: boolean;
  pgConnected: boolean | null;
  pgLast4: string | null;
  onboardingStatus: string | null;
  members: PlatformBarobillMemberRow[];
};

export function useTenantAddonSnapshot(tenantId: string | undefined): TenantAddonSnapshot {
  const [snap, setSnap] = useState<TenantAddonSnapshot>({
    loading: true,
    pgConnected: null,
    pgLast4: null,
    onboardingStatus: null,
    members: [],
  });

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setSnap((prev) => ({ ...prev, loading: true }));
    void Promise.all([
      fetchPlatformTenantCredential(tenantId).catch(() => null),
      fetchPlatformPgOnboardings({ tenantId, limit: 5, offset: 0 }).catch(() => null),
      fetchPlatformBarobillMembers(new URLSearchParams({ tenantId, datePreset: 'all', limit: '20', offset: '0' })).catch(
        () => null,
      ),
    ]).then(([cred, onboard, barobill]) => {
      if (cancelled) return;
      const first = onboard?.items[0];
      setSnap({
        loading: false,
        pgConnected: cred ? cred.connected : null,
        pgLast4: cred && 'apiKeyLast4' in cred ? cred.apiKeyLast4 : null,
        onboardingStatus: first?.status ?? null,
        members: barobill?.items ?? [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return snap;
}

export function PlatformTenantAddonStatus({ tenantId }: { tenantId: string }) {
  const snap = useTenantAddonSnapshot(tenantId);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">카드결제 PG · 계산서</h2>
      <p className="mt-0.5 text-xs text-gray-500">이 업체의 연결 상태입니다. 키 원문은 보여 주지 않습니다.</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div id="section-pg" className="scroll-mt-24">
          <dt className="text-xs text-gray-500">카드결제 PG</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {snap.loading
              ? '확인 중'
              : snap.pgConnected
                ? `연결됨 · 끝자리 ${snap.pgLast4 ?? ''}`
                : '연결 안 됨'}
            {!snap.loading && snap.onboardingStatus ? ` · 가입 ${snap.onboardingStatus}` : ''}
          </dd>
        </div>
        <div id="section-cashbill" className="scroll-mt-24">
          <dt className="text-xs text-gray-500">계산서(바로빌)</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {snap.loading
              ? '확인 중'
              : snap.members.length === 0
                ? '회원 없음'
                : snap.members.map((row) => BAROBILL_MEMBER_STATUS_LABEL[row.status] ?? row.status).join(', ')}
          </dd>
        </div>
        {!snap.loading && snap.members.some((row) => row.status === 'ACTIVE') ? (
          <div id="section-cert" className="scroll-mt-24">
            <dt className="text-xs text-gray-500">공동인증서</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {snap.members.some((row) => row.status === 'ACTIVE' && row.certValid) ? '유효' : '미등록'}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
