import { useCallback, useEffect, useState } from 'react';
import {
  cancelTeamCashbill,
  fetchTeamCashbillShare,
  fetchTeamCashbillView,
  listMyTeamCashbill,
  shareReceiptLink,
  type TeamCashbillMine,
} from '../../../api/teamCashbill';
import {
  cancelTeamTaxInvoice,
  fetchTeamTaxShare,
  fetchTeamTaxView,
  listMyTeamTaxInvoices,
  type TeamTaxMine,
} from '../../../api/teamTaxInvoice';
import { TeamCashbillIssueSheet } from './TeamCashbillIssueSheet';
import { TeamTaxInvoiceSheet } from './TeamTaxInvoiceSheet';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { useInboxRealtime } from '../../../hooks/useInboxRealtime';
import { teamBiPlain } from '../../../i18n/team/teamI18n';
import { getTeamToken } from '../../../stores/teamAuth';
import { teamFooterActionPrimaryClass, teamFooterActionSecondaryClass } from '../../../utils/teamInspectionDisplay';
import { STAFF_APP_SAFE_OVERLAY } from '../../../utils/staffAppSafeArea';

type Row = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  linked: boolean;
  totalWon: number;
  status: string;
  createdAt: string;
  usageLabel?: string;
  taxKind?: 'taxable' | 'exempt';
  canView: boolean;
  canShare: boolean;
  canCancel: boolean;
};

function whenText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function cashRow(item: TeamCashbillMine): Row {
  return {
    id: item.id,
    customerName: item.customerName,
    inquiryNumber: item.inquiryNumber,
    linked: item.linked,
    totalWon: item.totalWon,
    status: item.status,
    createdAt: item.createdAt,
    usageLabel: item.usageLabel,
    taxKind: item.taxKind,
    canView: Boolean(item.ntsConfirmNum) && item.status !== '취소됨',
    canShare: item.canSendReceipt,
    canCancel: item.canCancel,
  };
}

function taxRow(item: TeamTaxMine): Row {
  return {
    id: item.id,
    customerName: item.customerName,
    inquiryNumber: item.inquiryNumber,
    linked: item.linked,
    totalWon: item.totalWon,
    status: item.status,
    createdAt: item.createdAt,
    canView: item.approvalReady,
    canShare: item.canSendReceipt,
    canCancel: item.canCancel,
  };
}

/** 팀장 현금영수증·세금계산서 내역. 발행 창 탭은 쓰지 않는다. */
export function TeamReceiptHistory({ kind }: { kind: 'cash' | 'tax' }) {
  const label = kind === 'cash' ? '현금영수증' : '세금계산서';
  useDocumentTitle(teamBiPlain(kind === 'cash' ? 'team.cashbill.pageTitle' : 'team.taxinvoice.pageTitle'));
  const token = getTeamToken();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<'copied' | 'copied-app' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const task = kind === 'cash'
      ? listMyTeamCashbill().then((res) => res.items.map(cashRow))
      : listMyTeamTaxInvoices().then((res) => res.items.map(taxRow));
    void task
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '발행 내역을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  useInboxRealtime(token, load, Boolean(token));

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), copied === 'copied-app' ? 2200 : 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const openView = (id: string) => {
    const task = kind === 'cash' ? fetchTeamCashbillView(id) : fetchTeamTaxView(id);
    void task
      .then((res) => {
        const opened = window.open(res.url, '_blank', 'noopener');
        if (!opened) setError('창이 막혔습니다. 팝업을 허용해 주세요.');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'));
  };

  const share = (id: string) => {
    const task = kind === 'cash' ? fetchTeamCashbillShare(id) : fetchTeamTaxShare(id);
    void task
      .then((res) => shareReceiptLink({ brandName: res.brandName, label, totalWon: res.totalWon, url: res.url }))
      .then((result) => {
        if (result === 'copied' || result === 'copied-app') setCopied(result);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '영수증 주소를 받지 못했습니다.'));
  };

  const sendCancel = () => {
    if (!cancelId) return;
    setSaving(true);
    const task = kind === 'cash' ? cancelTeamCashbill(cancelId) : cancelTeamTaxInvoice(cancelId);
    void task
      .then(() => {
        setCancelId(null);
        load();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '취소하지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-3 sm:gap-3">
      <div className="flex flex-col gap-2">
        <h1 className="whitespace-nowrap text-fluid-base font-semibold text-slate-900">{label}</h1>
        <button type="button" onClick={() => setSheetOpen(true)} className={teamFooterActionPrimaryClass}>
          + 새로 발행
        </button>
      </div>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      {loading && items.length === 0 ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!loading && items.length === 0 ? <p className="text-fluid-sm text-slate-500">발행한 {label}이 없습니다.</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-fluid-sm font-medium text-slate-900">{item.customerName || '이름 없음'}</p>
                <p className="text-fluid-2xs text-slate-500">
                  {whenText(item.createdAt)}
                  {item.usageLabel ? ` · ${item.usageLabel}` : ''}
                  {item.taxKind ? (item.taxKind === 'exempt' ? ' · 면세' : ' · 과세') : ''}
                  {item.linked ? '' : ' · 연결 없음'}
                  {item.inquiryNumber ? ` · ${item.inquiryNumber}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">{item.totalWon.toLocaleString('ko-KR')}원</p>
                <p className="text-fluid-2xs text-slate-500">{item.status}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button type="button" disabled={!item.canView} onClick={() => openView(item.id)} className={`${teamFooterActionSecondaryClass} disabled:opacity-50`}>영수증 보기</button>
              <button type="button" disabled={!item.canShare} onClick={() => share(item.id)} className={`${teamFooterActionPrimaryClass} disabled:opacity-50`}>공유하기</button>
              <button type="button" disabled={!item.canCancel} onClick={() => setCancelId(item.id)} className={`${teamFooterActionSecondaryClass} disabled:opacity-50`}>취소</button>
            </div>
            {!item.canView && item.status !== '취소됨' ? (
              <p className="mt-1 text-center text-fluid-2xs text-slate-500">승인번호가 나오면 볼 수 있어요 (보통 몇 분)</p>
            ) : null}
          </li>
        ))}
      </ul>
      {kind === 'cash' ? (
        <TeamCashbillIssueSheet open={sheetOpen} inquiryId={null} showTaxTab={false} onClose={() => { setSheetOpen(false); load(); }} />
      ) : (
        <TeamTaxInvoiceSheet open={sheetOpen} inquiryId={null} showTabs={false} onClose={() => { setSheetOpen(false); load(); }} onCash={() => undefined} />
      )}
      {cancelId ? (
        <div className={`${STAFF_APP_SAFE_OVERLAY} fixed inset-0 z-[660] flex items-center justify-center bg-slate-900/45 p-4 pt-[max(1.5rem,env(safe-area-inset-top,0px),var(--cbiseo-safe-area-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]`}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-center text-fluid-sm font-semibold text-slate-900">{kind === 'cash' ? '이 현금영수증을 취소할까요? 취소하면 되돌릴 수 없어요' : '이 세금계산서를 취소할까요? 취소하면 되돌릴 수 없어요'}</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button type="button" disabled={saving} onClick={() => setCancelId(null)} className={teamFooterActionSecondaryClass}>닫기</button>
              <button type="button" disabled={saving} onClick={sendCancel} className={teamFooterActionPrimaryClass}>{saving ? '취소 중…' : '취소'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {copied ? (
        <div className={`${STAFF_APP_SAFE_OVERLAY} pointer-events-none fixed inset-0 z-[680] flex items-center justify-center p-4`}>
          <p className="rounded-full bg-slate-900 px-3 py-1.5 text-center text-fluid-xs text-white">
            {copied === 'copied-app' ? '링크를 복사했어요. 카톡에 붙여 넣어 주세요' : '링크를 복사했어요'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
