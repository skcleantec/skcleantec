import {
  ORDER_FORM_EXTRA_WORK_MAX_LINES,
  ORDER_FORM_EXTRA_WORK_NAME_MAX,
  ORDER_FORM_EXTRA_WORK_SUGGESTED_NAMES,
  type OrderFormExtraWorkLine,
} from '@shared/orderFormExtraWorks';
import {
  ORDER_FORM_CLEANING_KIND_OPTIONS,
  type OrderFormCleaningKind,
} from '@shared/orderFormCleaningKind';
import { applyManwonUnitZeros, parseIssueAmountWon } from '../../utils/orderFormIssueAmountInput';

/** 발급 화면에서 적는 중인 추가 시공 한 줄 — 금액은 글자 그대로 둔다 */
export type IssueExtraWorkRow = { name: string; amount: string };

export function issueExtraWorkLines(rows: IssueExtraWorkRow[]): OrderFormExtraWorkLine[] {
  return rows
    .map((row) => ({ name: row.name.trim(), amountWon: parseIssueAmountWon(row.amount) }))
    .filter((line) => line.name.length > 0);
}

/** 이름 없이 금액만 적었거나, 이름은 있는데 금액이 0인 줄을 찾아 안내 문구를 돌려준다 */
export function issueExtraWorkRowsError(rows: IssueExtraWorkRow[]): string | null {
  for (const row of rows) {
    const name = row.name.trim();
    const won = parseIssueAmountWon(row.amount);
    if (!name && won > 0) return '추가 시공 이름을 적어 주세요.';
    if (name && won <= 0) return `「${name}」 추가 금액을 적어 주세요.`;
  }
  return null;
}

const won = (n: number) => n.toLocaleString('ko-KR');

function IconClose() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** 발급 금액 상자 안 — 추가 시공 줄과 합계 */
export function OrderFormIssueExtraWorksBox({
  rows,
  onRowsChange,
  cleaningKind,
  onCleaningKindChange,
  baseAmountWon,
  depositWon,
  inputCls,
}: {
  rows: IssueExtraWorkRow[];
  onRowsChange: (next: IssueExtraWorkRow[]) => void;
  cleaningKind: OrderFormCleaningKind;
  onCleaningKindChange: (next: OrderFormCleaningKind) => void;
  baseAmountWon: number;
  depositWon: number;
  inputCls: string;
}) {
  if (rows.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onRowsChange([{ name: '', amount: '' }])}
        className="self-start rounded text-fluid-xs font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        + 추가 시공 넣기
      </button>
    );
  }

  const lines = issueExtraWorkLines(rows);
  const extraSum = lines.reduce((sum, line) => sum + line.amountWon, 0);
  const total = baseAmountWon + extraSum;
  const kindLabel = ORDER_FORM_CLEANING_KIND_OPTIONS.find((o) => o.value === cleaningKind)?.label ?? '기본 청소';
  const setRow = (index: number, patch: Partial<IssueExtraWorkRow>) =>
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const usedNames = new Set(rows.map((row) => row.name.trim()));
  const pickName = (name: string) => {
    const emptyIndex = rows.findIndex((row) => !row.name.trim());
    if (emptyIndex >= 0) setRow(emptyIndex, { name });
    else if (rows.length < ORDER_FORM_EXTRA_WORK_MAX_LINES) onRowsChange([...rows, { name, amount: '' }]);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2.5 rounded-lg border border-violet-200 bg-white p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-bold text-violet-800">추가 시공</span>
          <span className="text-fluid-2xs text-gray-500">고객 발주서 첫 화면과 금액 안내에 함께 보여요</span>
        </div>

        <label className="flex flex-wrap items-center gap-2 text-fluid-2xs text-gray-600">
          기본 청소
          <select
            value={cleaningKind}
            onChange={(e) => onCleaningKindChange(e.target.value as OrderFormCleaningKind)}
            className="h-8 rounded border border-gray-300 bg-white px-2 text-fluid-xs text-gray-900"
          >
            {ORDER_FORM_CLEANING_KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-fluid-2xs text-gray-500">자주 쓰는 이름</span>
          {ORDER_FORM_EXTRA_WORK_SUGGESTED_NAMES.map((name) => {
            const used = usedNames.has(name);
            return (
              <button
                key={name}
                type="button"
                disabled={used}
                onClick={() => pickName(name)}
                className={`rounded-full border px-2.5 py-0.5 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  used
                    ? 'border-violet-700 bg-violet-700 font-medium text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_9rem_auto_auto]">
              <input
                type="text"
                aria-label="추가 시공 이름"
                className={inputCls}
                placeholder="예: 인테리어 청소"
                maxLength={ORDER_FORM_EXTRA_WORK_NAME_MAX}
                value={row.name}
                onChange={(e) => setRow(index, { name: e.target.value })}
              />
              <button
                type="button"
                aria-label="이 줄 지우기"
                onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}
                className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 sm:order-last"
              >
                <IconClose />
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-label="추가 금액"
                className={`${inputCls} text-right tabular-nums`}
                placeholder="100000"
                value={row.amount}
                onChange={(e) => setRow(index, { amount: e.target.value.replace(/[^\d,]/g, '') })}
              />
              <button
                type="button"
                onClick={() => setRow(index, { amount: applyManwonUnitZeros(row.amount) })}
                className="rounded-md border border-sky-600 bg-sky-50 px-2 py-1.5 text-fluid-2xs font-semibold text-sky-900 hover:bg-sky-100"
              >
                단위만원
              </button>
            </div>
          ))}
        </div>

        {rows.length < ORDER_FORM_EXTRA_WORK_MAX_LINES ? (
          <button
            type="button"
            onClick={() => onRowsChange([...rows, { name: '', amount: '' }])}
            className="rounded text-fluid-xs font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            + 추가 시공 한 줄 더
          </button>
        ) : null}
      </div>

      <div className="rounded-lg bg-gray-900 px-3 py-2.5 text-white">
        <p className="break-keep text-fluid-2xs text-gray-300">
          {kindLabel} {won(baseAmountWon)}
          {lines.map((line) => ` + ${line.name} ${won(line.amountWon)}`).join('')}
        </p>
        <div className="mt-0.5 flex items-baseline justify-between">
          <span className="text-fluid-xs font-medium">총 견적</span>
          <span className="text-lg font-extrabold tabular-nums">{won(total)}원</span>
        </div>
        <p className="mt-0.5 text-right text-fluid-2xs tabular-nums text-gray-300">
          예약금 {won(depositWon)}원 · 잔금 {won(Math.max(0, total - depositWon))}원 (자동)
        </p>
      </div>
    </div>
  );
}

/** 고객 발주서 첫 화면 — 기본 청소와 함께 받는 추가 시공을 한 카드로 보여 준다 */
export function OrderFormPackageSummary({
  brandName,
  baseLabel,
  baseHint,
  baseAmountWon,
  extraWorks,
  totalAmountWon,
  depositAmountWon,
  balanceAmountWon,
}: {
  brandName?: string | null;
  baseLabel: string;
  baseHint?: string | null;
  baseAmountWon: number | null;
  extraWorks: OrderFormExtraWorkLine[];
  totalAmountWon: number;
  depositAmountWon: number;
  balanceAmountWon: number;
}) {
  const count = extraWorks.length + 1;
  return (
    <div className="space-y-3">
      <p className="text-fluid-sm leading-relaxed text-slate-500">
        {brandName ? `${brandName}에서 ` : ''}
        {count === 2 ? '두 가지' : `${count}가지`} 청소를 함께 진행합니다.
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-start gap-3.5 px-4 pb-4 pt-[1.125rem]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-slate-900 text-white" aria-hidden>
            <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v10h14V10" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-fluid-2xs font-bold text-slate-600">기본 청소</span>
            <span className="block break-keep text-lg font-extrabold text-slate-900">{baseLabel}</span>
            {baseHint ? <span className="block whitespace-pre-line text-fluid-xs text-slate-500">{baseHint}</span> : null}
          </span>
          {baseAmountWon != null ? (
            <span className="shrink-0 pt-[1.125rem] text-fluid-sm font-bold tabular-nums text-slate-900">{won(baseAmountWon)}원</span>
          ) : null}
        </div>

        {extraWorks.map((line, index) => (
          <div key={`${line.name}-${index}`}>
            <div className="flex items-center gap-2.5 px-4" aria-hidden>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-white">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="flex items-start gap-3.5 px-4 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-violet-100 text-violet-700" aria-hidden>
                <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
                  <path d="M18.5 15l.8 2 .2.2 2 .8-2 .8-.2.2-.8 2-.8-2-.2-.2-2-.8 2-.8.2-.2z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-fluid-2xs font-bold text-violet-700">함께 받는 추가 시공</span>
                <span className="block break-keep text-lg font-extrabold text-slate-900">{line.name}</span>
              </span>
              <span className="shrink-0 pt-[1.125rem] text-fluid-sm font-bold tabular-nums text-slate-900">{won(line.amountWon)}원</span>
            </div>
          </div>
        ))}

        <div className="space-y-1.5 bg-slate-900 px-4 py-4 text-white">
          <div className="flex items-baseline justify-between">
            <span className="text-fluid-sm font-medium text-slate-300">총 견적</span>
            <span className="text-2xl font-extrabold tabular-nums">{won(totalAmountWon)}원</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 text-fluid-xs tabular-nums text-slate-300">
            <span>{depositAmountWon > 0 ? `예약금 ${won(depositAmountWon)}원` : '예약금 없음'}</span>
            <span>청소 당일 잔금 {won(balanceAmountWon)}원</span>
          </div>
        </div>
      </div>
      <p className="px-1 text-fluid-xs leading-relaxed text-slate-500">
        내용이 다르면 담당자에게 알려 주세요. 다음 화면부터 주소와 일정을 적습니다.
      </p>
    </div>
  );
}

/** 금액 안내·목록에 쓰는 한 줄 요약. 예: 「입주청소 240,000 + 인테리어 청소 100,000」 */
export function extraWorksBreakdownText(
  baseLabel: string,
  baseAmountWon: number | null | undefined,
  extraWorks: OrderFormExtraWorkLine[] | null | undefined,
): string {
  if (!extraWorks?.length) return '';
  const head = baseAmountWon != null ? `${baseLabel} ${won(baseAmountWon)}원` : baseLabel;
  return [head, ...extraWorks.map((line) => `${line.name} ${won(line.amountWon)}원`)].join(' + ');
}
