import { useCallback, useEffect, useState } from 'react';
import {
  cashbillCustomerSms,
  fetchTeamCashbillShare,
  listMyTeamCashbill,
  requestTeamCashbillCancel,
  type TeamCashbillMine,
} from '../../api/teamCashbill';
import { openPaymentSms } from '../../utils/cardPaymentShare';
import { TeamCashbillIssueSheet } from '../../components/team/cashbill/TeamCashbillIssueSheet';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import { getTeamToken } from '../../stores/teamAuth';
import { teamFooterActionPrimaryClass, teamFooterActionSecondaryClass } from '../../utils/teamInspectionDisplay';

function whenText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TeamCashbillPage() {
  useDocumentTitle(teamBiPlain('team.cashbill.pageTitle'));
  const token = getTeamToken();
  const [items, setItems] = useState<TeamCashbillMine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void listMyTeamCashbill()
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '발행 내역을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useInboxRealtime(token, load, Boolean(token));

  const sendReceipt = (id: string) => {
    setSendingId(id);
    setError(null);
    void fetchTeamCashbillShare(id)
      .then((share) => {
        openPaymentSms(
          share.phone,
          cashbillCustomerSms({
            brandName: share.brandName,
            totalWon: share.totalWon,
            ntsConfirmNum: share.ntsConfirmNum,
            url: share.url,
          }),
        );
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '영수증 주소를 받지 못했습니다.'))
      .finally(() => setSendingId(null));
  };

  const sendCancel = () => {
    if (!cancelId) return;
    setSaving(true);
    void requestTeamCashbillCancel(cancelId)
      .then(() => {
        setCancelId(null);
        load();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '취소 요청을 보내지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3 p-3">
      <div className="flex flex-col gap-2">
        <h1 className="whitespace-nowrap text-fluid-base font-semibold text-slate-900">{teamBiPlain('team.cashbill.pageTitle')}</h1>
        <button type="button" onClick={() => setSheetOpen(true)} className={teamFooterActionPrimaryClass}>
          + 새로 발행
        </button>
      </div>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      {loading && items.length === 0 ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!loading && items.length === 0 ? <p className="text-fluid-sm text-slate-500">발행한 현금영수증이 없습니다.</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-fluid-sm font-medium text-slate-900">{item.customerName || '이름 없음'}</p>
                <p className="text-fluid-2xs text-slate-500">
                  {whenText(item.createdAt)}
                  {item.usageLabel ? ` · ${item.usageLabel}` : ''}
                  {item.linked ? '' : ' · 연결 없음'}
                  {item.inquiryNumber ? ` · ${item.inquiryNumber}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">{item.totalWon.toLocaleString('ko-KR')}원</p>
                <p className={`text-fluid-2xs ${item.status === '취소 요청됨' ? 'font-semibold text-amber-800' : 'text-slate-500'}`}>
                  {item.status}
                </p>
              </div>
            </div>
            {item.canSendReceipt || item.canRequestCancel ? (
              <div className="mt-2 grid gap-1.5">
                {item.canSendReceipt ? (
                  <button
                    type="button"
                    disabled={sendingId === item.id}
                    onClick={() => sendReceipt(item.id)}
                    className={teamFooterActionPrimaryClass}
                  >
                    영수증 보내기
                  </button>
                ) : null}
                {item.canRequestCancel ? (
                  <button type="button" onClick={() => setCancelId(item.id)} className={teamFooterActionSecondaryClass}>
                    사무실에 취소 요청
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <TeamCashbillIssueSheet
        open={sheetOpen}
        inquiryId={null}
        onClose={() => {
          setSheetOpen(false);
          load();
        }}
      />
      {cancelId ? (
        <div className="fixed inset-0 z-[660] flex items-center justify-center bg-slate-900/45 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-center text-fluid-sm font-semibold text-slate-900">사무실에 취소를 요청할까요?</p>
            <p className="mt-2 text-center text-fluid-xs text-slate-600">팀장 화면에서는 직접 취소할 수 없습니다.</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button type="button" disabled={saving} onClick={() => setCancelId(null)} className={teamFooterActionSecondaryClass}>
                닫기
              </button>
              <button type="button" disabled={saving} onClick={sendCancel} className={teamFooterActionPrimaryClass}>
                요청
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
