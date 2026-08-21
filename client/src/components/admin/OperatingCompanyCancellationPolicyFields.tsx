import {
  createCancellationPolicyTierId,
  formatCancellationDaysBeforeLabel,
  renderCancellationPolicyLines,
  renderFreeChangeDaysBeforeLine,
  type CancellationPenaltyKind,
  type CancellationPolicyTier,
  type OperatingCompanyCancellationPolicy,
} from '@shared/operatingCompanyCancellationPolicy';
import {
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
  GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE,
} from '@shared/orderFormGuidePlaceholders';

const KIND_OPTIONS: { value: CancellationPenaltyKind; label: string }[] = [
  { value: 'percent', label: '위약금 %' },
  { value: 'no_cancel', label: '취소·변경 불가' },
  { value: 'deposit_forfeit', label: '예약금 몰수' },
  { value: 'custom', label: '직접 입력' },
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

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(GUIDE_PLACEHOLDER_CANCELLATION_POLICY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        브랜드별 취소·변경 위약 구간입니다. 안내사항·발주 확인 문구에{' '}
        <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">
          {GUIDE_PLACEHOLDER_CANCELLATION_POLICY}
        </code>{' '}
        치환코드를 넣으면 아래 설정이 자동으로 반영됩니다.
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
        <h3 className="text-sm font-semibold text-gray-900">날짜 변경 가능 기준일</h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          청소일 며칠 <strong>전</strong>까지 위약금 없이 변경·취소할 수 있는지 설정합니다. 청소날짜 확인
          모달·안내사항에 아래 문장이 반영됩니다.
        </p>
        <label className="block text-sm">
          <span className="font-medium text-gray-800">기준일 (일)</span>
          <input
            type="number"
            min={0}
            max={365}
            value={value.freeChangeDaysBefore ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...value,
                freeChangeDaysBefore: raw === '' ? null : Math.max(0, Number(raw) || 0),
              });
            }}
            className="mt-1 w-full max-w-[8rem] border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            placeholder="예: 2"
          />
          <p className="mt-1 text-xs text-gray-500">비우면 해당 안내를 표시하지 않습니다.</p>
        </label>
        {freeChangePreview ? (
          <div className="rounded-md border border-emerald-200 bg-white px-2.5 py-2 text-xs text-gray-800 leading-relaxed">
            {freeChangePreview}
          </div>
        ) : (
          <p className="text-xs text-gray-500">기준일을 입력하면 미리보기가 표시됩니다.</p>
        )}
        <p className="text-xs text-gray-500">
          청소날짜 확인 문구 편집 시{' '}
          <code className="rounded bg-white px-1 font-mono text-[11px]">{GUIDE_PLACEHOLDER_FREE_CHANGE_DAYS_LINE}</code>{' '}
          치환코드를 쓸 수 있습니다.
        </p>
      </section>

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
                    value={tier.kind}
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
                {tier.kind === 'percent' ? (
                  <label className="text-xs text-gray-600">
                    %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tier.percent ?? 0}
                      onChange={(e) =>
                        updateTier(index, {
                          percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="mt-0.5 block w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </label>
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
              {tier.kind === 'custom' ? (
                <textarea
                  rows={2}
                  value={tier.customText ?? ''}
                  onChange={(e) => updateTier(index, { customText: e.target.value })}
                  placeholder="표시할 문구를 직접 입력"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              ) : null}
              <input
                type="text"
                value={tier.note ?? ''}
                onChange={(e) => updateTier(index, { note: e.target.value })}
                placeholder="보조 설명 (선택)"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">미리보기</span>
          <button
            type="button"
            onClick={() => void copyToken()}
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
      </div>
    </div>
  );
}
