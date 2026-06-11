import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import {
  acceptTenantPartnership,
  listTenantPartnerships,
  lookupTenantPartner,
  rejectTenantPartnership,
  requestTenantPartnership,
  suspendTenantPartnership,
  type TenantPartnershipItem,
} from '../../api/tenantPartners';

const STATUS_LABEL: Record<TenantPartnershipItem['status'], string> = {
  PENDING: '승인 대기',
  ACTIVE: '연결됨',
  SUSPENDED: '중지',
  REJECTED: '거절됨',
};

const STATUS_CLASS: Record<TenantPartnershipItem['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-gray-200 text-gray-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export function AdminTenantPartnersPage() {
  const token = getToken();
  const [items, setItems] = useState<TenantPartnershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSlug, setInviteSlug] = useState('');
  const [inviteMemo, setInviteMemo] = useState('');
  const [lookupName, setLookupName] = useState<string | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    void listTenantPartnerships(token)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setActionId(id);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다.');
    } finally {
      setActionId(null);
    }
  };

  const handleLookup = async () => {
    if (!token) return;
    const slug = inviteSlug.trim().toLowerCase();
    if (!slug) {
      setLookupName(null);
      setLookupErr(null);
      return;
    }
    setLookupErr(null);
    try {
      const r = await lookupTenantPartner(token, slug);
      setLookupName(r.partner.name);
    } catch (e) {
      setLookupName(null);
      setLookupErr(e instanceof Error ? e.message : '조회 실패');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const slug = inviteSlug.trim().toLowerCase();
    if (!slug) return;
    setInviteSubmitting(true);
    setError(null);
    try {
      await requestTenantPartnership(token, {
        partnerSlug: slug,
        memo: inviteMemo.trim() || undefined,
      });
      setShowInvite(false);
      setInviteSlug('');
      setInviteMemo('');
      setLookupName(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const pendingIncoming = items.filter((i) => i.status === 'PENDING' && i.needsMyAcceptance);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-800">파트너 연결</h1>
          <p className="mt-1 text-sm text-gray-500">
            같은 시스템을 쓰는 다른 청소업체와 파트너로 연결합니다. 양쪽 관리자가 승인하면 접수를 서로
            연계할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowInvite(true);
            setLookupName(null);
            setLookupErr(null);
          }}
          className="shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          파트너 초대
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {pendingIncoming.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-950">
            승인 대기 {pendingIncoming.length}건 — 상대 업체의 파트너 연결 요청을 확인해 주세요.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-medium text-gray-800">파트너 목록</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            등록된 파트너가 없습니다. 상대 업체 코드로 초대해 주세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">상대 업체</th>
                  <th className="px-4 py-2 font-medium">업체 코드</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 font-medium">승인</th>
                  <th className="px-4 py-2 font-medium text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.partner.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.partner.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {row.status === 'PENDING' ? (
                        <>
                          나 {row.myAcceptedAt ? '✓' : '—'} · 상대 {row.partnerAcceptedAt ? '✓' : '—'}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.canAccept ? (
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() =>
                              void runAction(row.id, () =>
                                token ? acceptTenantPartnership(token, row.id) : Promise.resolve(),
                              )
                            }
                            className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            승인
                          </button>
                        ) : null}
                        {row.canReject ? (
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => {
                              if (!window.confirm(`${row.partner.name} 파트너 요청을 거절할까요?`)) return;
                              void runAction(row.id, () =>
                                token ? rejectTenantPartnership(token, row.id) : Promise.resolve(),
                              );
                            }}
                            className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            거절
                          </button>
                        ) : null}
                        {row.canSuspend ? (
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => {
                              if (!window.confirm(`${row.partner.name}와의 파트너 연결을 중지할까요?`)) return;
                              void runAction(row.id, () =>
                                token ? suspendTenantPartnership(token, row.id) : Promise.resolve(),
                              );
                            }}
                            className="rounded border border-amber-300 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                          >
                            중지
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <ModalCloseButton onClick={() => setShowInvite(false)} />
            <h3 className="text-lg font-semibold text-gray-900">파트너 초대</h3>
            <p className="mt-1 text-xs text-gray-500">상대 업체의 로그인 화면 「업체 코드」를 입력하세요.</p>
            <form onSubmit={handleInvite} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">업체 코드</span>
                <div className="flex gap-2">
                  <input
                    value={inviteSlug}
                    onChange={(e) => setInviteSlug(e.target.value.toLowerCase())}
                    onBlur={() => void handleLookup()}
                    placeholder="예: test"
                    className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => void handleLookup()}
                    className="shrink-0 rounded border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
                  >
                    확인
                  </button>
                </div>
                {lookupName ? (
                  <p className="mt-1 text-xs text-emerald-700">업체명: {lookupName}</p>
                ) : null}
                {lookupErr ? <p className="mt-1 text-xs text-red-600">{lookupErr}</p> : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">메모 (선택)</span>
                <input
                  value={inviteMemo}
                  onChange={(e) => setInviteMemo(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  maxLength={500}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviteSubmitting ? '요청 중…' : '초대 보내기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
