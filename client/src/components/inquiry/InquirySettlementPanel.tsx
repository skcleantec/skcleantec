import { useEffect, useMemo, useState } from 'react';
import {
  createAdminInquiryExtraCharge,
  createTeamInquiryExtraCharge,
  deleteAdminInquiryExtraCharge,
  deleteTeamInquiryExtraCharge,
  listAdminInquiryExtraCharges,
  listTeamInquiryExtraCharges,
  patchAdminInquiryExtraCharge,
  patchTeamInquiryExtraCharge,
  type InquiryExtraCharge,
} from '../../api/inquiryExtraCharges';

interface Props {
  inquiryId: string;
  token: string | null;
  /** 사용할 API 경로 — 기본 'team'. 관리자/마케터 UI에서는 'admin'. */
  mode?: 'team' | 'admin';
  /** 발주서 스냅샷 금액 — 없으면 '—'로 표시 */
  serviceTotalAmount: number | null | undefined;
  serviceDepositAmount: number | null | undefined;
  serviceBalanceAmount: number | null | undefined;
  /** 부모가 이미 알고 있는 초기 extraCharges (첫 렌더 시 로딩 스킵) */
  initialExtraCharges?: Array<{
    id: string;
    description: string;
    amount: number;
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

export function InquirySettlementPanel({
  inquiryId,
  token,
  mode = 'team',
  serviceTotalAmount,
  serviceDepositAmount,
  serviceBalanceAmount,
  initialExtraCharges,
  readOnly = false,
  onChanged,
}: Props) {
  const api = {
    list: mode === 'admin' ? listAdminInquiryExtraCharges : listTeamInquiryExtraCharges,
    create: mode === 'admin' ? createAdminInquiryExtraCharge : createTeamInquiryExtraCharge,
    patch: mode === 'admin' ? patchAdminInquiryExtraCharge : patchTeamInquiryExtraCharge,
    remove: mode === 'admin' ? deleteAdminInquiryExtraCharge : deleteTeamInquiryExtraCharge,
  };
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftDesc, setDraftDesc] = useState('');
  const [draftAmt, setDraftAmt] = useState('');

  useEffect(() => {
    if (readOnly) return;
    if (!token) return;
    // 초기값이 있으면 건너뛰고, 없으면 조회
    if (initialExtraCharges && initialExtraCharges.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.list(token, inquiryId);
        if (!cancelled) setItems(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId, token]);

  const totals = useMemo(() => {
    const extraSum = items.reduce((s, x) => s + x.amount, 0);
    const balance = serviceBalanceAmount ?? 0;
    const total = serviceTotalAmount ?? 0;
    const receive = balance + extraSum;
    const grand = total + extraSum;
    return { extraSum, receive, grand };
  }, [items, serviceBalanceAmount, serviceTotalAmount]);

  async function handleAdd() {
    if (!token) return;
    setError(null);
    const desc = draftDesc.trim();
    const amt = normalizeAmount(draftAmt);
    if (!desc) {
      setError('항목명을 입력해주세요.');
      return;
    }
    if (amt == null) {
      setError('금액은 숫자로 입력해주세요 (할인은 -값).');
      return;
    }
    setBusy(true);
    try {
      const created = await api.create(token, inquiryId, {
        description: desc,
        amount: amt,
      });
      setItems((prev) => [...prev, created]);
      setDraftDesc('');
      setDraftAmt('');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePatch(
    id: string,
    next: { description?: string; amount?: number },
    prev: InquiryExtraCharge,
  ) {
    if (!token) return;
    setItems((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              description: next.description ?? r.description,
              amount: next.amount ?? r.amount,
            }
          : r,
      ),
    );
    setError(null);
    try {
      const updated = await api.patch(token, inquiryId, id, next);
      setItems((rows) => rows.map((r) => (r.id === id ? updated : r)));
      onChanged?.();
    } catch (e) {
      setItems((rows) => rows.map((r) => (r.id === id ? prev : r)));
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return;
    const snapshot = items;
    setItems((rows) => rows.filter((r) => r.id !== id));
    setError(null);
    try {
      await api.remove(token, inquiryId, id);
      onChanged?.();
    } catch (e) {
      setItems(snapshot);
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
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
  const balanceDisplay =
    serviceBalanceAmount != null ? formatWon(serviceBalanceAmount) : '—';

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-3 py-2 sm:px-4">
        <h3 className="text-fluid-xs font-semibold text-blue-900">결제 금액 내역</h3>
        <span className="text-fluid-2xs text-blue-800">할인은 금액에 -를 붙여 입력</span>
      </header>

      <div className="divide-y divide-gray-100 bg-white">
        {row('총 결제금액', totalDisplay)}
        {row('예약금(선결제)', depositDisplay, 'minus')}
        {row('잔금', balanceDisplay, 'accent')}
      </div>

      <details className="group border-t-2 border-blue-200 bg-white open:bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-blue-100 bg-gray-50/90 px-3 py-2.5 text-left hover:bg-gray-100 sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-fluid-2xs font-medium text-gray-800 sm:text-fluid-xs">
            추가·할인 항목
            {items.length > 0 ? (
              <span className="ml-1.5 tabular-nums text-gray-600">({items.length}건)</span>
            ) : null}
            <span className="ml-1.5 block text-fluid-2xs font-normal text-gray-500 sm:inline">
              · 합계·총 결제금액(추가 반영)
            </span>
          </span>
          <span className="shrink-0 rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium tabular-nums text-gray-600 sm:text-fluid-2xs">
            <span className="group-open:hidden">펼치기</span>
            <span className="hidden group-open:inline">접기</span>
          </span>
        </summary>

        <div className="border-b border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <li className="px-3 py-3 text-fluid-xs text-gray-400 sm:px-4">
                아직 추가된 항목이 없습니다.
              </li>
            ) : (
              items.map((it) => (
                <ExtraChargeRow
                  key={it.id}
                  item={it}
                  readOnly={readOnly}
                  onPatch={(next) => handlePatch(it.id, next, it)}
                  onDelete={() => handleDelete(it.id)}
                />
              ))
            )}
          </ul>

          {!readOnly ? (
            <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                <input
                  type="text"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="항목명 (예: 곰팡이 제거)"
                  maxLength={120}
                  disabled={busy}
                  className="min-w-0 rounded-md border border-gray-300 px-2.5 py-2 text-fluid-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:flex-1"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={draftAmt}
                  onChange={(e) => setDraftAmt(formatAmountInputDisplay(e.target.value))}
                  placeholder="금액 (예: 40000 · 4만)"
                  disabled={busy}
                  className="min-w-0 rounded-md border border-gray-300 px-2.5 py-2 text-right text-fluid-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-40"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAdd();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={busy}
                  className="hidden min-h-[40px] items-center justify-center rounded-md bg-blue-600 px-3.5 text-fluid-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 sm:inline-flex"
                >
                  + 항목 추가
                </button>
              </div>
              <AmountQuickChips
                disabled={busy}
                draft={draftAmt}
                onChange={setDraftAmt}
              />
              {draftAmt.trim() && normalizeAmount(draftAmt) != null ? (
                <p className="mt-1 text-fluid-2xs text-gray-500">
                  입력 금액:{' '}
                  <span className="tabular-nums font-medium text-gray-700">
                    {formatWonSigned(normalizeAmount(draftAmt) ?? 0)}
                  </span>
                </p>
              ) : null}
              {error ? (
                <p className="mt-1.5 text-fluid-2xs text-rose-700">{error}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={busy}
                className="mt-2 inline-flex h-9 w-full shrink-0 items-center justify-center rounded-md bg-blue-600 px-3 text-fluid-2xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 sm:hidden"
              >
                + 항목 추가
              </button>
            </div>
          ) : null}

          <div className="divide-y divide-gray-100 border-t-2 border-blue-200 bg-blue-50/60">
            {row(
              '추가·할인 합계',
              totals.extraSum === 0 ? '0원' : formatWonSigned(totals.extraSum),
              totals.extraSum > 0 ? 'plus' : totals.extraSum < 0 ? 'minus' : undefined,
            )}
            {row(
              '총 결제받을 금액 (잔금 + 추가·할인)',
              serviceBalanceAmount != null ? formatWon(totals.receive) : '—',
              'accent',
            )}
            {serviceTotalAmount != null
              ? row('총 결제금액(추가 반영)', formatWon(totals.grand))
              : null}
          </div>
        </div>
      </details>
    </section>
  );
}

function ExtraChargeRow({
  item,
  readOnly,
  onPatch,
  onDelete,
}: {
  item: InquiryExtraCharge;
  readOnly: boolean;
  onPatch: (next: { description?: string; amount?: number }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [amt, setAmt] = useState(String(item.amount));
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDesc(item.description);
      setAmt(formatAmountInputDisplay(String(item.amount)));
    }
  }, [item.amount, item.description, editing]);

  async function save() {
    setLocalErr(null);
    const d = desc.trim();
    const n = normalizeAmount(amt);
    if (!d) {
      setLocalErr('항목명을 입력해주세요.');
      return;
    }
    if (n == null) {
      setLocalErr('금액을 숫자로 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      await onPatch({ description: d, amount: n });
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
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-fluid-sm text-gray-900" title={item.description}>
            {item.description}
          </span>
          <span
            className={`shrink-0 tabular-nums text-fluid-sm font-semibold ${
              item.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatWonSigned(item.amount)}
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
      <AmountQuickChips
        disabled={busy}
        draft={amt}
        onChange={setAmt}
        compact
      />
      {amt.trim() && normalizeAmount(amt) != null ? (
        <p className="mt-1 text-fluid-2xs text-gray-500">
          입력 금액:{' '}
          <span className="tabular-nums font-medium text-gray-700">
            {formatWonSigned(normalizeAmount(amt) ?? 0)}
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

/** 모바일에서 0 을 여러 번 치지 않도록 천·만 단위 금액을 한 번에 더하는 버튼.
 * `compact` 는 편집 인라인 행처럼 공간이 좁을 때 사용. */
function AmountQuickChips({
  disabled,
  draft,
  onChange,
  compact,
}: {
  disabled?: boolean;
  draft: string;
  onChange: (next: string) => void;
  compact?: boolean;
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(toggleDraftSign(draft))}
        className={`${baseBtn} ${sizePad} ${
          draft.trim().startsWith('-')
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : ''
        }`}
        title="할인(-)로 바꾸기"
      >
        ±부호
      </button>
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
