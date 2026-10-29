import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  postPlatformInboxAction,
  postPlatformInboxBulkApprove,
  type InboxMoneyRow,
  type PlatformInboxPayload,
} from '../../api/platformInbox';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION } from '../../utils/platformUi';
import { PlatformStatusBadge, waitingLabel, waitingTone } from './PlatformStatusBadge';

const KIND_LABEL = {
  charge: '충전 신청',
  deposit: '입금 확인 요청',
  overdue: '미납·연체',
} as const;

const REVIEW = [
  { key: 'signup', label: '가입승인', to: '/platform/signup-inquiries' },
  { key: 'planUpgrade', label: '유료 전환', to: '/platform/plan-upgrade-requests' },
  { key: 'landingLink', label: '문의 링크', to: '/platform/landing-contact-link-requests' },
  { key: 'pg', label: 'PG 가입', to: '/platform/card-payment' },
  { key: 'barobill', label: '바로빌', to: '/platform/barobill-members' },
] as const;

const BTN =
  'rounded-lg px-3 py-1.5 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

type ConfirmState =
  | { mode: 'one'; row: InboxMoneyRow; action: 'approve' | 'reject' }
  | { mode: 'bulk'; rows: InboxMoneyRow[] };

export function PlatformInboxQueue({
  inbox,
  onChange,
}: {
  inbox: PlatformInboxPayload;
  onChange: (next: PlatformInboxPayload) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedRows = useMemo(
    () => inbox.money.filter((row) => selected.includes(rowKey(row))),
    [inbox.money, selected],
  );

  const toggle = (row: InboxMoneyRow) => {
    const key = rowKey(row);
    setSelected((prev) => (prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]));
  };

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setError('');
    try {
      if (confirm.mode === 'bulk') {
        const result = await postPlatformInboxBulkApprove(
          confirm.rows.map((row) => ({ kind: row.kind, id: row.id, tenantId: row.tenantId })),
        );
        onChange(result.inbox);
        if (result.failed > 0) setError(`${result.failed}건은 이미 처리되어 건너뛰었습니다.`);
      } else {
        const next = await postPlatformInboxAction({
          kind: confirm.row.kind,
          id: confirm.row.id,
          tenantId: confirm.row.tenantId,
          action: confirm.action,
        });
        onChange(next);
      }
      setSelected([]);
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">돈 처리</h2>
          <button
            type="button"
            disabled={selectedRows.length === 0 || busy}
            onClick={() => setConfirm({ mode: 'bulk', rows: selectedRows })}
            className={`${BTN_PRIMARY} ${BTN}`}
          >
            선택 승인 {selectedRows.length > 0 ? selectedRows.length : ''}
          </button>
        </div>
        {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        {inbox.money.length === 0 ? (
          <p className="text-fluid-sm text-gray-500">처리할 입금·충전이 없습니다.</p>
        ) : (
          <>
            <ul className="space-y-2 lg:hidden">
              {inbox.money.map((row) => (
                <li key={rowKey(row)} className="rounded-lg border border-gray-200 p-2">
                  <MoneyBody row={row} selected={selected.includes(rowKey(row))} onToggle={() => toggle(row)} busy={busy} onAct={setConfirm} />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-fluid-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-fluid-xs text-gray-500">
                    <th className="px-2 py-2 text-center font-medium">선택</th>
                    <th className="px-2 py-2 text-center font-medium">구분</th>
                    <th className="px-2 py-2 text-center font-medium">업체</th>
                    <th className="px-2 py-2 text-center font-medium">금액</th>
                    <th className="px-2 py-2 text-center font-medium">입금자명</th>
                    <th className="px-2 py-2 text-center font-medium">대기</th>
                    <th className="px-2 py-2 text-center font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.money.map((row) => (
                    <tr key={rowKey(row)} className="border-b border-gray-100">
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={selected.includes(rowKey(row))} onChange={() => toggle(row)} aria-label={`${row.tenantName} 선택`} />
                      </td>
                      <td className="px-2 py-2 text-left text-gray-800">{KIND_LABEL[row.kind]}</td>
                      <td className="px-2 py-2 text-left font-medium text-gray-900">{row.tenantName}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-900">{row.amountKrw.toLocaleString('ko-KR')}원</td>
                      <td className="px-2 py-2 text-left text-gray-600">{row.depositorName ?? '—'}</td>
                      <td className="px-2 py-2 text-center">
                        <PlatformStatusBadge tone={waitingTone(row.waitingSince)}>{waitingLabel(row.waitingSince)}</PlatformStatusBadge>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <RowActions row={row} busy={busy} onAct={setConfirm} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">검토</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {REVIEW.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                <span className="text-gray-900">{item.label}</span>
                <PlatformStatusBadge tone={inbox.review[item.key] > 0 ? 'warn' : 'ok'}>
                  {`${inbox.review[item.key]}건`}
                </PlatformStatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {confirm ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              {confirm.mode === 'bulk' ? `${confirm.rows.length}건 승인` : confirm.action === 'approve' ? '승인' : '반려'}
            </h3>
            <p className="mt-2 text-fluid-sm text-gray-600">
              {confirm.mode === 'bulk'
                ? '선택한 항목을 승인합니다. 이미 처리된 건은 잔액이 두 번 늘지 않습니다.'
                : `${confirm.row.tenantName} · ${confirm.row.amountKrw.toLocaleString('ko-KR')}원`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={`${BTN_SECONDARY} ${BTN}`} disabled={busy} onClick={() => setConfirm(null)}>
                취소
              </button>
              <button type="button" className={`${BTN_PRIMARY} ${BTN}`} disabled={busy} onClick={() => void run()}>
                {busy ? '처리 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function rowKey(row: InboxMoneyRow) {
  return `${row.kind}:${row.id}`;
}

function RowActions({
  row,
  busy,
  onAct,
}: {
  row: InboxMoneyRow;
  busy: boolean;
  onAct: (next: ConfirmState) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" className={`${BTN_PRIMARY} ${BTN}`} disabled={busy} onClick={() => onAct({ mode: 'one', row, action: 'approve' })}>
        승인
      </button>
      {row.canReject ? (
        <button type="button" className={`${BTN_SECONDARY} ${BTN}`} disabled={busy} onClick={() => onAct({ mode: 'one', row, action: 'reject' })}>
          반려
        </button>
      ) : null}
    </div>
  );
}

function MoneyBody({
  row,
  selected,
  onToggle,
  busy,
  onAct,
}: {
  row: InboxMoneyRow;
  selected: boolean;
  onToggle: () => void;
  busy: boolean;
  onAct: (next: ConfirmState) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`${row.tenantName} 선택`} />
        <p className="min-w-0 flex-1 truncate text-fluid-sm font-medium text-gray-900">{row.tenantName}</p>
        <PlatformStatusBadge tone={waitingTone(row.waitingSince)}>{waitingLabel(row.waitingSince)}</PlatformStatusBadge>
      </div>
      <p className="text-right text-fluid-sm tabular-nums text-gray-900">{row.amountKrw.toLocaleString('ko-KR')}원</p>
      <p className="truncate text-fluid-xs text-gray-500">
        {KIND_LABEL[row.kind]}
        {row.depositorName ? ` · ${row.depositorName}` : ''}
      </p>
      <RowActions row={row} busy={busy} onAct={onAct} />
    </div>
  );
}
