import { Link } from 'react-router-dom';
import { formatScheduleD2SendHourKo } from '@shared/alimtalkScheduleD2Timing';
import {
  buildPenaltyLineMap,
  computeFreeChangeDeadlineYmd,
  createCancellationPolicyTierId,
  formatCancellationDaysBeforeLabel,
  penaltyLineGuideToken,
  renderCancellationPolicyLines,
  renderFreeChangeDaysBeforeLine,
  type CancellationPenaltyKind,
  type CancellationPolicyTier,
  type OperatingCompanyCancellationPolicy,
} from '@shared/operatingCompanyCancellationPolicy';
import {
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
  GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_BEFORE,
  GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE,
  GUIDE_PLACEHOLDER_PENALTY_LINES,
  ORDER_FORM_GUIDE_PLACEHOLDERS,
} from '@shared/orderFormGuidePlaceholders';
import { ALIMTALK_SETTINGS_PATH } from '../../constants/operatingCompanyNav';

/** 미리보기용 청소일 — 실제 접수일과 무관 */
const EXAMPLE_CLEAN_YMD = '2026-09-10';
const FREE_CHANGE_PRESETS = [2, 3] as const;

const PRESET_BTN =
  'rounded-lg px-3 py-1.5 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function formatMonthDayKo(ymd: string): string {
  const parts = ymd.split('-');
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return ymd;
  return `${m}월 ${d}일`;
}

const KIND_OPTIONS: { value: CancellationPenaltyKind; label: string }[] = [
  { value: 'percent', label: '위약금 %' },
  { value: 'no_cancel', label: '취소·변경 불가' },
  { value: 'deposit_forfeit', label: '예약금 몰수' },
];

function moveTier(tiers: CancellationPolicyTier[], from: number, dir: -1 | 1): CancellationPolicyTier[] {
  const to = from + dir;
  if (to < 0 || to >= tiers.length) return tiers;
  const next = tiers.map((t, i) => ({ ...t, sortOrder: i }));
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next.map((t, i) => ({ ...t, sortOrder: i }));
}

export function OperatingCompanyCancellationPolicyFields(props: {
  value: OperatingCompanyCancellationPolicy;
  onChange: (next: OperatingCompanyCancellationPolicy) => void;
}) {
  const { value, onChange } = props;
  const previewLines = renderCancellationPolicyLines(value);
  const freeChangePreview = renderFreeChangeDaysBeforeLine(value.freeChangeDaysBefore);
  const exampleDeadlineYmd = computeFreeChangeDeadlineYmd(
    EXAMPLE_CLEAN_YMD,
    value.freeChangeDaysBefore,
  );
  const alimtalkSendPreview =
    value.enabled && exampleDeadlineYmd
      ? `청소일 ${formatMonthDayKo(EXAMPLE_CLEAN_YMD)}이면 → ${formatMonthDayKo(exampleDeadlineYmd)} ${formatScheduleD2SendHourKo()}에 일정 확인 알림`
      : null;
  const penaltyLineMap = buildPenaltyLineMap(value);
  const penaltyTokens = [...value.tiers]
    .sort((a, b) => b.daysBefore - a.daysBefore)
    .map((t) => penaltyLineGuideToken(t.daysBefore));

  const updateTier = (index: number, patch: Partial<CancellationPolicyTier>) => {
    onChange({
      ...value,
      tiers: value.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });
  };

  const addTier = () => {
    onChange({
      ...value,
      tiers: [
        ...value.tiers,
        {
          id: createCancellationPolicyTierId(),
          sortOrder: value.tiers.length,
          daysBefore: 0,
          kind: 'percent',
          percent: 30,
        },
      ],
    });
  };

  const removeTier = (index: number) => {
    onChange({
      ...value,
      tiers: value.tiers.filter((_, i) => i !== index).map((t, i) => ({ ...t, sortOrder: i })),
    });
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        먼저 <strong>위약 없이 바꿀 수 있는 마지막 날</strong>만 정하면 됩니다. 위약 금액 구간과 안내
        문구 치환코드는 아래 「자세히」에 있습니다.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span className="font-medium text-gray-800">위약금 정책 사용</span>
      </label>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">위약 없이 바꿀 수 있는 마지막 날</h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          청소일 며칠 <strong>전</strong>까지 위약금 없이 변경·취소할 수 있는지 고릅니다. 그 마지막 날{' '}
          {formatScheduleD2SendHourKo()}에 일정 확인 알림이 나갑니다.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {FREE_CHANGE_PRESETS.map((days) => {
            const selected = value.freeChangeDaysBefore === days;
            return (
              <button
                key={days}
                type="button"
                disabled={!value.enabled}
                onClick={() => onChange({ ...value, freeChangeDaysBefore: days })}
                className={`${PRESET_BTN} ${
                  selected
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {days}일{days === 2 ? ' (추천)' : ''}
              </button>
            );
          })}
          <button
            type="button"
            disabled={!value.enabled}
            onClick={() => {
              if (value.freeChangeDaysBefore === 2 || value.freeChangeDaysBefore === 3) {
                onChange({ ...value, freeChangeDaysBefore: null });
              }
            }}
            className={`${PRESET_BTN} ${
              value.freeChangeDaysBefore !== 2 && value.freeChangeDaysBefore !== 3
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            직접
          </button>
        </div>
        {value.freeChangeDaysBefore !== 2 && value.freeChangeDaysBefore !== 3 ? (
          <label className="block text-sm">
            <span className="font-medium text-gray-800">며칠 전</span>
            <input
              type="number"
              min={0}
              max={365}
              value={value.freeChangeDaysBefore ?? ''}
              disabled={!value.enabled}
              onChange={(e) => {
                const raw = e.target.value.trim();
                onChange({
                  ...value,
                  freeChangeDaysBefore: raw === '' ? null : Math.max(0, Number(raw) || 0),
                });
              }}
              className="mt-1 w-full max-w-[8rem] border border-gray-300 rounded px-3 py-2 text-sm bg-white disabled:opacity-50"
              placeholder="예: 4"
            />
            <p className="mt-1 text-xs text-gray-500">비우면 안내·알림 기준일이 없습니다.</p>
          </label>
        ) : null}
        {alimtalkSendPreview ? (
          <div className="rounded-md border border-emerald-200 bg-white px-2.5 py-2 text-xs text-gray-800 leading-relaxed">
            {alimtalkSendPreview}
          </div>
        ) : (
          <p className="text-xs text-gray-500">2일·3일 또는 직접 숫자를 넣으면 알림 미리보기가 나옵니다.</p>
        )}
        {freeChangePreview ? (
          <p className="text-xs text-gray-600 leading-relaxed">{freeChangePreview}</p>
        ) : null}
        <p className="text-xs text-gray-500">
          알림 ON/OFF는{' '}
          <Link
            to={ALIMTALK_SETTINGS_PATH}
            className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded-sm"
          >
            알림톡
          </Link>
          에서 합니다. 예약금 반환 등 추가 문장은{' '}
          <Link
            to="/admin/inquiries/order-customer-preview?panel=guide"
            className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded-sm"
          >
            발주서설정 → 안내·동의
          </Link>
          에서 브랜드별로 적습니다.
        </p>
      </section>

      <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-gray-800 hover:text-gray-950">
          위약 금액 구간 · 안내 문구 (자세히)
        </summary>
        <div className="mt-3 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">위약 구간</span>
          <button
            type="button"
            onClick={addTier}
            disabled={!value.enabled}
            className="text-xs text-blue-600 hover:underline disabled:opacity-40"
          >
            + 구간 추가
          </button>
        </div>

        {value.enabled && value.tiers.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-2">
            구간을 1개 이상 추가해 주세요.
          </p>
        ) : null}

        <div className="space-y-2">
          {value.tiers.map((tier, index) => (
            <div
              key={tier.id}
              className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-600">
                  며칠 전
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={tier.daysBefore}
                    onChange={(e) =>
                      updateTier(index, {
                        daysBefore: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="mt-0.5 block w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </label>
                <span className="text-xs text-gray-500 pt-4">
                  ({formatCancellationDaysBeforeLabel(tier.daysBefore)})
                </span>
                <label className="text-xs text-gray-600 flex-1 min-w-[7rem]">
                  유형
                  <select
                    value={tier.kind === 'custom' ? 'percent' : tier.kind}
                    onChange={(e) =>
                      updateTier(index, { kind: e.target.value as CancellationPenaltyKind })
                    }
                    className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {tier.kind === 'percent' || tier.kind === 'custom' ? (
                  <label className="text-xs text-gray-600">
                    %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tier.percent ?? 0}
                      onChange={(e) =>
                        updateTier(index, {
                          kind: 'percent',
                          percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="mt-0.5 block w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </label>
                ) : null}
                {tier.kind === 'custom' ? (
                  <p className="w-full text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    레거시 「직접 입력」 구간입니다. % 또는 다른 유형으로 바꾸면 고정 템플릿 문장으로 표시됩니다.
                  </p>
                ) : null}
                <div className="flex items-end gap-1 ml-auto pt-4">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onChange({ ...value, tiers: moveTier(value.tiers, index, -1) })}
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white disabled:opacity-40"
                    title="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === value.tiers.length - 1}
                    onClick={() => onChange({ ...value, tiers: moveTier(value.tiers, index, 1) })}
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white disabled:opacity-40"
                    title="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded bg-white hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {penaltyLineMap.get(tier.daysBefore) ? (
                <p className="text-xs text-gray-600 leading-relaxed">
                  <code className="rounded bg-white px-1 font-mono text-[11px]">
                    {penaltyLineGuideToken(tier.daysBefore)}
                  </code>{' '}
                  → {penaltyLineMap.get(tier.daysBefore)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">전체 미리보기</span>
          <button
            type="button"
            onClick={() => void copyToken(GUIDE_PLACEHOLDER_CANCELLATION_POLICY)}
            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          >
            {GUIDE_PLACEHOLDER_CANCELLATION_POLICY} 복사
          </button>
        </div>
        {previewLines.length ? (
          <ul className="space-y-1.5 text-xs text-gray-700 leading-relaxed">
            {previewLines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">정책이 꺼져 있거나 구간이 없습니다.</p>
        )}

        <div className="border-t border-slate-200 pt-2 space-y-1.5">
          <p className="text-xs font-medium text-gray-800">치환코드 (구간별)</p>
          <ul className="space-y-1 text-xs text-gray-600">
            {ORDER_FORM_GUIDE_PLACEHOLDERS.filter((p) =>
              [
                GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE,
                GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_BEFORE,
                GUIDE_PLACEHOLDER_PENALTY_LINES,
                GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
                ...penaltyTokens,
              ].includes(p.token),
            ).map((p) => (
              <li key={p.token} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => void copyToken(p.token)}
                  className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[11px] hover:bg-gray-50"
                >
                  {p.token}
                </button>
                <span>{p.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
