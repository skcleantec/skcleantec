import { useEffect, useMemo, useState } from 'react';
import {
  listAdminInquiryExtraCharges,
  listTeamInquiryExtraCharges,
  type InquiryExtraCharge,
} from '../../api/inquiryExtraCharges';
import {
  createAdminInquiryAdditionalReceipt,
  createTeamInquiryAdditionalReceipt,
  deleteAdminInquiryAdditionalReceipt,
  deleteTeamInquiryAdditionalReceipt,
  listAdminInquiryAdditionalReceipts,
  listTeamInquiryAdditionalReceipts,
  patchAdminInquiryAdditionalReceipt,
  patchTeamInquiryAdditionalReceipt,
  type InquiryAdditionalReceipt,
  type AdditionalReceiptSettlementChannel,
} from '../../api/inquiryAdditionalReceipts';

interface Props {
  inquiryId: string;
  token: string | null;
  /** 사용할 API 경로 — 기본 'team'. 관리자/마케터 UI에서는 'admin'. */
  mode?: 'team' | 'admin';
  /** 발주서 스냅샷 금액 — 없으면 '—'로 표시 */
  serviceTotalAmount: number | null | undefined;
  serviceDepositAmount: number | null | undefined;
  serviceBalanceAmount: number | null | undefined;
  /** 레거시 `InquiryExtraCharge`(과거 현장 추가 금액) — 표시·합계용. 신규 입력은 추가결재만 */
  initialExtraCharges?: Array<{
    id: string;
    description: string;
    amount: number;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: { id: string; name: string } | null;
  }>;
  /** 일반 서비스와 별도 저장되는 추가결재(관리자 정한 비율로 정산) */
  initialAdditionalReceipts?: Array<{
    id: string;
    description: string;
    amount: number;
    settlementChannel?: AdditionalReceiptSettlementChannel | string;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: { id: string; name: string } | null;
  }>;
  /** 읽기 전용 모드 — 관리자 등이 수정 권한 없이 보는 경우 */
  readOnly?: boolean;
  /** 변경 발생 시 부모가 캐시를 갱신하도록 */
  onChanged?: () => void;
}

function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatWonSigned(n: number): string {
  if (n > 0) return `+${n.toLocaleString('ko-KR')}원`;
  if (n < 0) return `-${Math.abs(n).toLocaleString('ko-KR')}원`;
  return '0원';
}

/** "40,000" / "40000" / "4만" / "4만5천" / "4.5만" / "-2만" 등 한글 약어도 허용 */
function normalizeAmount(raw: string): number | null {
  let s = raw.trim().replace(/[,\s원]/g, '');
  if (!s) return null;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? sign * n : null;
  }
  // 한글 단위 조합: "4만", "4만5천", "3천", "1억2천만" 등
  const unitMap: Record<string, number> = { 억: 1e8, 만: 1e4, 천: 1e3, 백: 1e2 };
  let total = 0;
  let i = 0;
  let consumed = false;
  while (i < s.length) {
    const m = s.slice(i).match(/^(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const num = Number(m[1]);
    i += m[1].length;
    if (i < s.length && unitMap[s[i]] != null) {
      total += num * unitMap[s[i]];
      i += 1;
      consumed = true;
    } else if (i === s.length) {
      total += num;
      consumed = true;
    } else {
      return null;
    }
  }
  if (!consumed) return null;
  return Math.round(sign * total);
}

function normalizePositiveAmount(raw: string): number | null {
  const n = normalizeAmount(raw);
  if (n == null || n < 1) return null;
  return n;
}

/** 입력창에 콤마 자동 삽입 — 한글 단위가 포함되면 그대로 두고, 숫자만 있으면 콤마 포맷 */
function formatAmountInputDisplay(raw: string): string {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!cleaned) return '';
  let sign = '';
  let rest = cleaned;
  if (rest.startsWith('-')) {
    sign = '-';
    rest = rest.slice(1);
  } else if (rest.startsWith('+')) {
    rest = rest.slice(1);
  }
  if (!rest) return sign;
  // 한글 단위가 섞여 있으면 변환하지 않고 원본 유지
  if (/[억만천백원]/.test(rest)) return sign + rest;
  if (!/^\d+$/.test(rest)) return raw;
  const n = Number(rest);
  if (!Number.isFinite(n)) return raw;
  return sign + n.toLocaleString('ko-KR');
}

/** 현재 draft 값에 delta 를 더한 금액을 콤마 포맷으로 돌려줌 */
function addToDraftAmount(draft: string, delta: number): string {
  const current = normalizeAmount(draft) ?? 0;
  const next = current + delta;
  return formatAmountInputDisplay(String(next));
}

/** 현재 draft 값의 부호를 바꿈 (빈값이면 그대로) */
function toggleDraftSign(draft: string): string {
  const n = normalizeAmount(draft);
  if (n == null || n === 0) {
    // 빈값/0이면 '-' 를 토글로 넣기만
    if (draft.trim().startsWith('-')) return draft.replace(/^\s*-/, '');
    return '-' + draft.replace(/^\+/, '');
  }
  return formatAmountInputDisplay(String(-n));
}

function coerceArcSettlementChannel(
  raw: string | undefined | null,
): AdditionalReceiptSettlementChannel {
  return raw === 'FIELD_RECEIVED' ? 'FIELD_RECEIVED' : 'COMPANY_DEPOSIT';
}

function additionalReceiptChannelLabel(ch: AdditionalReceiptSettlementChannel): string {
  return ch === 'FIELD_RECEIVED' ? '현장결재(본인수금)' : '회사입금';
}

function AdditionalReceiptRow({
  item,
  readOnly,
  onPatch,
  onDelete,
}: {
  item: InquiryAdditionalReceipt;
  readOnly: boolean;
  onPatch: (next: {
    description?: string;
    amount?: number;
    settlementChannel?: AdditionalReceiptSettlementChannel;
  }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [amt, setAmt] = useState(String(item.amount));
  const [channel, setChannel] = useState<AdditionalReceiptSettlementChannel>(item.settlementChannel);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDesc(item.description);
      setAmt(formatAmountInputDisplay(String(item.amount)));
      setChannel(item.settlementChannel);
    }
  }, [item.amount, item.description, item.settlementChannel, editing]);

  async function save() {
    setLocalErr(null);
    const d = desc.trim();
    const n = normalizePositiveAmount(amt);
    if (!d) {
      setLocalErr('항목명을 입력해주세요.');
      return;
    }
    if (n == null) {
      setLocalErr('금액은 1원 이상 숫자로 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await onPatch({ description: d, amount: n, settlementChannel: channel });
      setEditing(false);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (readOnly || !editing) {
    return (
      <li className="px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 flex-1 truncate text-fluid-sm text-gray-900" title={item.description}>
            {item.description}
          </span>
          <span className="shrink-0 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-fluid-2xs font-medium text-gray-700">
            {additionalReceiptChannelLabel(item.settlementChannel)}
          </span>
          <span className="shrink-0 tabular-nums text-fluid-sm font-semibold text-emerald-700">
            {formatWon(item.amount)}
          </span>
          {!readOnly ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-fluid-2xs text-gray-700 hover:bg-gray-50"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                className="rounded border border-rose-200 bg-white px-2 py-1 text-fluid-2xs text-rose-700 hover:bg-rose-50"
              >
                − 삭제
              </button>
            </div>
          ) : null}
        </div>
        {item.createdBy?.name ? (
          <div className="mt-0.5 text-fluid-2xs text-gray-400">{item.createdBy.name}</div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="bg-blue-50/40 px-3 py-2 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={120}
          disabled={busy}
          className="min-w-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-fluid-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:flex-1"
        />
        <input
          type="text"
          inputMode="numeric"
          value={amt}
          onChange={(e) => setAmt(formatAmountInputDisplay(e.target.value))}
          disabled={busy}
          className="min-w-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-right text-fluid-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-32"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="hidden rounded-md bg-blue-600 px-3 text-fluid-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 sm:inline-flex sm:items-center"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setLocalErr(null);
          }}
          disabled={busy}
          className="hidden rounded-md border border-gray-300 bg-white px-3 text-fluid-xs text-gray-700 hover:bg-gray-50 sm:inline-flex sm:items-center"
        >
          취소
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5 border-t border-blue-100/80 pt-2">
        <span className="text-fluid-2xs font-medium text-gray-700">수금 방식</span>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-fluid-2xs text-gray-800">
            <input
              type="radio"
              name={`arc-ch-${item.id}`}
              checked={channel === 'FIELD_RECEIVED'}
              disabled={busy}
              onChange={() => setChannel('FIELD_RECEIVED')}
              className="text-blue-600"
            />
            현장결재 (본인이 받음)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-fluid-2xs text-gray-800">
            <input
              type="radio"
              name={`arc-ch-${item.id}`}
              checked={channel === 'COMPANY_DEPOSIT'}
              disabled={busy}
              onChange={() => setChannel('COMPANY_DEPOSIT')}
              className="text-blue-600"
            />
            회사입금
          </label>
        </div>
      </div>
      <AmountQuickChips disabled={busy} draft={amt} onChange={setAmt} compact allowSignToggle={false} />
      {amt.trim() && normalizePositiveAmount(amt) != null ? (
        <p className="mt-1 text-fluid-2xs text-gray-500">
          입력 금액:{' '}
          <span className="tabular-nums font-medium text-gray-700">
            {formatWon(normalizePositiveAmount(amt) ?? 0)}
          </span>
        </p>
      ) : null}
      {localErr ? (
        <p className="mt-1 text-fluid-2xs text-rose-700">{localErr}</p>
      ) : null}
      <div className="mt-2 flex gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-blue-600 px-3 text-fluid-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setLocalErr(null);
          }}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-fluid-sm text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
      </div>
    </li>
  );
}

export function InquirySettlementPanel({
  inquiryId,
  token,
  mode = 'team',
  serviceTotalAmount,
  serviceDepositAmount,
  serviceBalanceAmount,
  initialExtraCharges,
  initialAdditionalReceipts,
  readOnly = false,
  onChanged,
}: Props) {
  const extraListApi =
    mode === 'admin' ? listAdminInquiryExtraCharges : listTeamInquiryExtraCharges;
  const [items, setItems] = useState<InquiryExtraCharge[]>(() =>
    (initialExtraCharges ?? []).map((x) => ({
      id: x.id,
      inquiryId,
      description: x.description,
      amount: x.amount,
      sortOrder: x.sortOrder ?? 0,
      createdAt: x.createdAt ?? new Date().toISOString(),
      updatedAt: x.updatedAt ?? new Date().toISOString(),
      createdBy: x.createdBy ?? null,
    })),
  );
  const arcApi = {
    list: mode === 'admin' ? listAdminInquiryAdditionalReceipts : listTeamInquiryAdditionalReceipts,
    create:
      mode === 'admin' ? createAdminInquiryAdditionalReceipt : createTeamInquiryAdditionalReceipt,
    patch:
      mode === 'admin' ? patchAdminInquiryAdditionalReceipt : patchTeamInquiryAdditionalReceipt,
    remove:
      mode === 'admin' ? deleteAdminInquiryAdditionalReceipt : deleteTeamInquiryAdditionalReceipt,
  };
  const [arcItems, setArcItems] = useState<InquiryAdditionalReceipt[]>(() =>
    (initialAdditionalReceipts ?? []).map((x) => ({
      id: x.id,
      inquiryId,
      description: x.description,
      amount: x.amount,
      settlementChannel: coerceArcSettlementChannel(x.settlementChannel),
      sortOrder: x.sortOrder ?? 0,
      createdAt: x.createdAt ?? new Date().toISOString(),
      updatedAt: x.updatedAt ?? new Date().toISOString(),
      createdBy: x.createdBy ?? null,
    })),
  );
  const [arcBusy, setArcBusy] = useState(false);
  const [arcError, setArcError] = useState<string | null>(null);
  const [arcDraftDesc, setArcDraftDesc] = useState('');
  const [arcDraftAmt, setArcDraftAmt] = useState('');
  const [arcSettlementChannel, setArcSettlementChannel] = useState<
    AdditionalReceiptSettlementChannel | null
  >(() => (mode === 'admin' ? 'COMPANY_DEPOSIT' : null));
  const [channelReminderOpen, setChannelReminderOpen] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    if (!token) return;
    // 초기값이 있으면 건너뛰고, 없으면 조회
    if (initialExtraCharges && initialExtraCharges.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await extraListApi(token, inquiryId);
        if (!cancelled) setItems(rows);
      } catch {
        /* 레거시 추가 금액 미표시 — 추가결재 본문은 계속 사용 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId, token]);

  useEffect(() => {
    if (readOnly) return;
    if (!token) return;
    if (initialAdditionalReceipts && initialAdditionalReceipts.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await arcApi.list(token, inquiryId);
        if (!cancelled) setArcItems(rows);
      } catch (e) {
        if (!cancelled)
          setArcError(e instanceof Error ? e.message : '추가결재 목록을 불러올 수 없습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId, token]);

  /** 예전 InquiryExtraCharge 로 저장된 금액만 잔금·총액에 반영된 합계 (신규 입력 UI 없음) */
  const legacyExtraTotals = useMemo(() => {
    const legacySum = items.reduce((s, x) => s + x.amount, 0);
    const total = serviceTotalAmount ?? 0;
    const grand = total + legacySum;
    return { legacySum, grand };
  }, [items, serviceTotalAmount]);

  const arcSumTotal = useMemo(() => arcItems.reduce((s, x) => s + x.amount, 0), [arcItems]);
  /** 회사가 고객에게 거둘 추가 미수에만 포함. 현장결재는 이미 팀장 수금으로 잔금에서 제외 */
  const arcCompanyDepositSum = useMemo(
    () =>
      arcItems.reduce(
        (s, x) => s + (x.settlementChannel === 'COMPANY_DEPOSIT' ? x.amount : 0),
        0,
      ),
    [arcItems],
  );
  const arcFieldReceivedSum = useMemo(
    () =>
      arcItems.reduce(
        (s, x) => s + (x.settlementChannel === 'FIELD_RECEIVED' ? x.amount : 0),
        0,
      ),
    [arcItems],
  );

  /** DB 서비스 잔금 + 회사입금 추가결재 + 레거시 현장 추가 */
  const collectibleBalanceAmount =
    (serviceBalanceAmount ?? 0) + arcCompanyDepositSum + legacyExtraTotals.legacySum;
  const hasCollectibleBalance =
    serviceBalanceAmount != null ||
    arcSumTotal !== 0 ||
    legacyExtraTotals.legacySum !== 0;

  async function handleArcAdd() {
    if (!token) return;
    setArcError(null);
    const desc = arcDraftDesc.trim();
    const amt = normalizePositiveAmount(arcDraftAmt);
    if (!desc) {
      setArcError('항목명을 입력해주세요.');
      return;
    }
    if (amt == null) {
      setArcError('추가결재 금액은 1원 이상 숫자로 입력해 주세요.');
      return;
    }
    if (mode === 'team' && arcSettlementChannel === null) {
      setChannelReminderOpen(true);
      return;
    }
    const settlementChannel = arcSettlementChannel ?? 'COMPANY_DEPOSIT';
    setArcBusy(true);
    try {
      const created = await arcApi.create(token, inquiryId, {
        description: desc,
        amount: amt,
        settlementChannel,
      });
      setArcItems((prev) => [...prev, created]);
      setArcDraftDesc('');
      setArcDraftAmt('');
      setArcSettlementChannel(mode === 'admin' ? 'COMPANY_DEPOSIT' : null);
      onChanged?.();
    } catch (e) {
      setArcError(e instanceof Error ? e.message : '추가결재 추가에 실패했습니다.');
    } finally {
      setArcBusy(false);
    }
  }

  async function handleArcPatch(
    id: string,
    next: {
      description?: string;
      amount?: number;
      settlementChannel?: AdditionalReceiptSettlementChannel;
    },
    prev: InquiryAdditionalReceipt,
  ) {
    if (!token) return;
    setArcItems((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              description: next.description ?? r.description,
              amount: next.amount ?? r.amount,
              settlementChannel: next.settlementChannel ?? r.settlementChannel,
            }
          : r,
      ),
    );
    setArcError(null);
    try {
      const updated = await arcApi.patch(token, inquiryId, id, next);
      setArcItems((rows) => rows.map((r) => (r.id === id ? updated : r)));
      onChanged?.();
    } catch (e) {
      setArcItems((rows) => rows.map((r) => (r.id === id ? prev : r)));
      setArcError(e instanceof Error ? e.message : '추가결재 수정에 실패했습니다.');
    }
  }

  async function handleArcDelete(id: string) {
    if (!token) return;
    if (!window.confirm('이 추가결재 항목을 삭제하시겠습니까?')) return;
    const snapshot = arcItems;
    setArcItems((rows) => rows.filter((r) => r.id !== id));
    setArcError(null);
    try {
      await arcApi.remove(token, inquiryId, id);
      onChanged?.();
    } catch (e) {
      setArcItems(snapshot);
      setArcError(e instanceof Error ? e.message : '추가결재 삭제에 실패했습니다.');
    }
  }

  const row = (label: string, value: string, tone?: 'muted' | 'accent' | 'plus' | 'minus') => (
    <div className="flex items-center justify-between px-3 py-2 sm:px-4">
      <span
        className={
          tone === 'accent'
            ? 'text-fluid-xs font-semibold text-gray-700'
            : 'text-fluid-xs font-medium text-gray-500'
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          tone === 'plus'
            ? 'font-semibold text-emerald-700'
            : tone === 'minus'
              ? 'font-semibold text-rose-700'
              : tone === 'accent'
                ? 'font-semibold text-gray-900'
                : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );

  const totalDisplay =
    serviceTotalAmount != null ? formatWon(serviceTotalAmount) : '—';
  const depositDisplay =
    serviceDepositAmount != null ? formatWon(serviceDepositAmount) : '—';
  const balanceDisplay = hasCollectibleBalance ? formatWon(collectibleBalanceAmount) : '—';

  return (
    <>
      <section className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-3 py-2 sm:px-4">
        <h3 className="text-fluid-xs font-semibold text-blue-900">결제 금액 내역</h3>
        <span className="max-w-[58%] text-right text-fluid-2xs leading-snug text-blue-800">
          총액·예약금은 서비스 계약 기준. 잔금은 회사입금 추가결재만 포함(현장결재 제외)
        </span>
      </header>

      <div className="divide-y divide-gray-100 bg-white">
        {row('총 결제금액 (서비스)', totalDisplay)}
        {row('예약금(선결제)', depositDisplay, 'minus')}
        {arcItems.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4"
          >
            <span
              className="min-w-0 flex-1 truncate text-fluid-xs text-gray-700"
              title={`추가결재 · ${it.description}`}
            >
              <span className="font-medium text-gray-800">추가결재</span>
              <span className="text-gray-500"> · </span>
              <span>{it.description}</span>
              <span className="ml-1.5 shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 tabular-nums sm:text-fluid-2xs">
                {it.settlementChannel === 'FIELD_RECEIVED' ? '현장' : '회사입금'}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-fluid-xs font-semibold text-emerald-700">
              {formatWon(it.amount)}
            </span>
          </div>
        ))}
        {arcItems.length > 0 ? (
          <div className="bg-slate-50/90 px-3 py-2 sm:px-4">
            <p className="text-fluid-2xs leading-snug text-gray-600">
              <strong className="font-medium text-gray-800">총 결제금액(서비스)</strong> 숫자는 계약·발주 원금 그대로
              두고, 아래 <strong className="font-medium text-gray-800">잔금</strong>에는{' '}
              <strong className="font-medium text-gray-800">회사입금</strong> 추가결재만 더합니다.{' '}
              <strong className="font-medium text-gray-800">현장결재</strong>는 이미 수금된 금액이라 회사 미수 잔금에
              넣지 않습니다. 급여 정산은 회사입금/현장과 「추가결재 회사 몫」비율을 따릅니다.
            </p>
          </div>
        ) : null}
        {arcFieldReceivedSum !== 0 ? (
          <div className="flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 sm:px-4">
            <span className="min-w-0 flex-1 text-fluid-2xs leading-snug text-gray-600">
              현장결재 추가합계 (참고 · 회사 미수 아님)
            </span>
            <span className="shrink-0 tabular-nums text-fluid-xs font-medium text-gray-700">
              {formatWon(arcFieldReceivedSum)}
            </span>
          </div>
        ) : null}
        {row('잔금 (회사 수금·회사입금 추가 포함)', balanceDisplay, 'accent')}
      </div>

      {items.length > 0 ? (
        <div className="border-t-2 border-amber-200 bg-amber-50/30">
          <div className="border-b border-amber-100 px-3 py-2.5 sm:px-4">
            <p className="text-fluid-2xs font-medium text-amber-950">예전 방식으로 저장된 현장 추가 금액</p>
            <p className="mt-0.5 text-fluid-2xs leading-snug text-amber-900/85">
              신규 항목은 <strong className="font-semibold text-amber-950">추가결재</strong>에서만 입력할 수 있습니다. 이 목록은 읽기
              전용입니다.
            </p>
          </div>
          <ul className="divide-y divide-amber-100/80 bg-white">
            {items.map((it) => (
              <li key={it.id} className="px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2">
                  <span
                    className="min-w-0 flex-1 truncate text-fluid-sm text-gray-900"
                    title={it.description}
                  >
                    {it.description}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums text-fluid-sm font-semibold ${
                      it.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatWonSigned(it.amount)}
                  </span>
                </div>
                {it.createdBy?.name ? (
                  <div className="mt-0.5 text-fluid-2xs text-gray-400">{it.createdBy.name}</div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="divide-y divide-amber-100 border-t-2 border-amber-200 bg-amber-50/50">
            {row(
              '추가 금액 합계 (레거시)',
              legacyExtraTotals.legacySum === 0
                ? '0원'
                : formatWonSigned(legacyExtraTotals.legacySum),
              legacyExtraTotals.legacySum > 0
                ? 'plus'
                : legacyExtraTotals.legacySum < 0
                  ? 'minus'
                  : undefined,
            )}
            {serviceTotalAmount != null
              ? row('총 결제금액 (레거시 추가 반영)', formatWon(legacyExtraTotals.grand))
              : null}
          </div>
        </div>
      ) : null}

      <details className="group border-t-2 border-blue-200 bg-white open:bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-blue-100 bg-gray-50/90 px-3 py-2.5 text-left hover:bg-gray-100 sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-fluid-2xs font-medium text-gray-800 sm:text-fluid-xs">
            추가결재 (별도 정산)
            {arcItems.length > 0 ? (
              <span className="ml-1.5 tabular-nums text-gray-600">({arcItems.length}건)</span>
            ) : null}
            <span className="ml-1.5 block text-fluid-2xs font-normal text-gray-500 sm:inline">
              · 서비스 잔금과 분리 · 회사/현장 수금 방식에 따라 일당 정산
            </span>
          </span>
          <span className="shrink-0 rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium tabular-nums text-gray-600 sm:text-fluid-2xs">
            <span className="group-open:hidden">펼치기</span>
            <span className="hidden group-open:inline">접기</span>
          </span>
        </summary>

        <div className="border-b border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {arcItems.length === 0 ? (
              <li className="px-3 py-3 text-fluid-xs text-gray-400 sm:px-4">
                추가결재 항목이 없습니다.
              </li>
            ) : (
              arcItems.map((it) => (
                <AdditionalReceiptRow
                  key={it.id}
                  item={it}
                  readOnly={readOnly}
                  onPatch={(next) => handleArcPatch(it.id, next, it)}
                  onDelete={() => void handleArcDelete(it.id)}
                />
              ))
            )}
          </ul>

          {!readOnly ? (
            <div className="border-t border-gray-100 bg-blue-50/40 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                <input
                  type="text"
                  value={arcDraftDesc}
                  onChange={(e) => setArcDraftDesc(e.target.value)}
                  placeholder="추가결재 항목명"
                  maxLength={120}
                  disabled={arcBusy}
                  className="min-w-0 rounded-md border border-gray-300 px-2.5 py-2 text-fluid-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:min-w-[120px] sm:flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleArcAdd();
                    }
                  }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={arcDraftAmt}
                  onChange={(e) => setArcDraftAmt(formatAmountInputDisplay(e.target.value))}
                  placeholder="금액 (1원 이상)"
                  disabled={arcBusy}
                  className="min-w-0 rounded-md border border-gray-300 px-2.5 py-2 text-right text-fluid-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-40"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleArcAdd();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleArcAdd()}
                  disabled={arcBusy}
                  className="inline-flex min-h-[40px] w-full shrink-0 items-center justify-center rounded-md bg-blue-600 px-4 text-fluid-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 sm:mt-0 sm:w-auto sm:px-3.5"
                >
                  저장
                </button>
              </div>
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5">
                <p className="mb-2 text-fluid-2xs font-medium text-gray-800 sm:text-fluid-xs">
                  추가결재 수금 방식{' '}
                  <span className="text-rose-600" aria-hidden>
                    *
                  </span>
                  <span className="font-normal text-gray-500"> (저장 시 필수)</span>
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
                  <label className="flex cursor-pointer items-center gap-2 text-fluid-2xs text-gray-800 sm:text-fluid-xs">
                    <input
                      type="radio"
                      name="arc-draft-settlement"
                      checked={arcSettlementChannel === 'FIELD_RECEIVED'}
                      onChange={() => setArcSettlementChannel('FIELD_RECEIVED')}
                      disabled={arcBusy}
                      className="text-blue-600"
                    />
                    현장결재 (본인이 받음)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-fluid-2xs text-gray-800 sm:text-fluid-xs">
                    <input
                      type="radio"
                      name="arc-draft-settlement"
                      checked={arcSettlementChannel === 'COMPANY_DEPOSIT'}
                      onChange={() => setArcSettlementChannel('COMPANY_DEPOSIT')}
                      disabled={arcBusy}
                      className="text-blue-600"
                    />
                    회사입금
                  </label>
                </div>
              </div>
              <AmountQuickChips
                disabled={arcBusy}
                draft={arcDraftAmt}
                onChange={setArcDraftAmt}
                allowSignToggle={false}
              />
              {arcDraftAmt.trim() && normalizePositiveAmount(arcDraftAmt) != null ? (
                <p className="mt-1 text-fluid-2xs text-gray-500">
                  입력 금액:{' '}
                  <span className="tabular-nums font-medium text-gray-700">
                    {formatWon(normalizePositiveAmount(arcDraftAmt) ?? 0)}
                  </span>
                </p>
              ) : null}
              {arcError ? (
                <p className="mt-1.5 text-fluid-2xs text-rose-700">{arcError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="divide-y divide-gray-100 border-t-2 border-blue-200 bg-blue-50/60">
            {row(
              '추가결재 합계 (급여 정산 대상)',
              arcSumTotal === 0 ? '0원' : formatWon(arcSumTotal),
              arcSumTotal > 0 ? 'plus' : undefined,
            )}
            {arcCompanyDepositSum !== 0 || arcFieldReceivedSum !== 0 ? (
              <div className="px-3 py-2 text-fluid-2xs leading-snug text-gray-600 sm:px-4">
                회사입금 {arcCompanyDepositSum === 0 ? '0원' : formatWon(arcCompanyDepositSum)} · 현장결재{' '}
                {arcFieldReceivedSum === 0 ? '0원' : formatWon(arcFieldReceivedSum)} (잔금에는 회사입금만 반영)
              </div>
            ) : null}
          </div>
        </div>
      </details>
    </section>
    {channelReminderOpen ? (
      <div
        className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 px-4 py-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arc-channel-reminder-title"
      >
        <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
          <h4 id="arc-channel-reminder-title" className="text-fluid-sm font-semibold text-gray-900">
            추가결재 수금 방식을 선택해 주세요
          </h4>
          <p className="mt-2 text-fluid-xs leading-relaxed text-gray-600">
            <strong className="font-medium text-gray-800">현장결재 (본인이 받음)</strong> 또는{' '}
            <strong className="font-medium text-gray-800">회사입금</strong> 중 하나를 고른 뒤 저장할 수
            있습니다.
          </p>
          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-fluid-xs font-semibold text-white hover:bg-blue-700"
            onClick={() => setChannelReminderOpen(false)}
          >
            확인
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}

/** 모바일에서 0 을 여러 번 치지 않도록 천·만 단위 금액을 한 번에 더하는 버튼.
 * `compact` 는 편집 인라인 행처럼 공간이 좁을 때 사용. */
function AmountQuickChips({
  disabled,
  draft,
  onChange,
  compact,
  allowSignToggle = true,
}: {
  disabled?: boolean;
  draft: string;
  onChange: (next: string) => void;
  compact?: boolean;
  /** false면 추가결재 등 양수만 허용할 때 ±부호 버튼 숨김 */
  allowSignToggle?: boolean;
}) {
  const presets: Array<{ label: string; delta: number }> = [
    { label: '+1천', delta: 1_000 },
    { label: '+5천', delta: 5_000 },
    { label: '+1만', delta: 10_000 },
    { label: '+10만', delta: 100_000 },
  ];
  const baseBtn =
    'shrink-0 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 tabular-nums';
  const sizePad = compact
    ? 'h-6 min-h-0 px-1.5 text-[10px] leading-none sm:h-7 sm:px-2 sm:text-fluid-2xs'
    : 'h-6 min-h-0 px-1.5 text-[10px] leading-none sm:h-7 sm:px-2 sm:text-fluid-2xs md:h-8 md:px-2.5 md:text-fluid-xs';
  return (
    <div
      className={`${
        compact ? 'mt-1.5' : 'mt-2'
      } flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 sm:pb-0 [&::-webkit-scrollbar]:hidden`}
    >
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          disabled={disabled}
          onClick={() => onChange(addToDraftAmount(draft, p.delta))}
          className={`${baseBtn} ${sizePad}`}
        >
          {p.label}
        </button>
      ))}
      <span
        className="mx-0.5 inline-block h-3 w-px shrink-0 self-center bg-gray-200 sm:h-3.5"
        aria-hidden
      />
      {allowSignToggle ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(toggleDraftSign(draft))}
          className={`${baseBtn} ${sizePad} ${
            draft.trim().startsWith('-')
              ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : ''
          }`}
          title="금액 부호 바꾸기"
        >
          ±부호
        </button>
      ) : null}
      <button
        type="button"
        disabled={disabled || !draft}
        onClick={() => onChange('')}
        className={`${baseBtn} ${sizePad} text-gray-500`}
      >
        지우기
      </button>
    </div>
  );
}
