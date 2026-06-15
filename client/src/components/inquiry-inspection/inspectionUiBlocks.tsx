import { useState, type ReactNode } from 'react';
import {
  INSPECTION_AREA_GUIDE,
  INSPECTION_BASIC_QUESTIONS,
  INSPECTION_CUSTOM_AREA_GUIDE,
  INSPECTION_HEADER_INTRO,
  INSPECTION_ITEM_GUIDE,
  INSPECTION_NA_CUSTOMER_NOTICE,
  INSPECTION_PRE_CLEAN_GUIDE,
  countItemPhotoProgress,
  formatInspectionNaReason,
  isItemComplete,
} from '@shared/inquiryInspectionTemplate';
import {
  INSPECTION_CONSENT_ITEMS,
  INSPECTION_FINAL_CONFIRM_NOTICE,
} from '@shared/inquiryInspectionConsent';
import type { InspectionArea, InspectionChecklistDto, InspectionItem } from '../../api/inquiryInspection';

export type InspectionPhotoMode = 'before-only' | 'after-only' | 'both';

type YesNoProps = {
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
};

function YesNoToggle({ value, onChange, disabled, label }: YesNoProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-fluid-2xs text-gray-600 min-w-[3rem]">{label}</span>
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`rounded-lg border px-2.5 py-1 text-fluid-2xs touch-manipulation ${
            value === v
              ? v
                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border-rose-600 bg-rose-50 text-rose-900'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          {v ? '예' : '아니오'}
        </button>
      ))}
    </div>
  );
}

function itemStats(item: InspectionItem) {
  const beforeCount = item.photos.filter((p) => p.phase === 'BEFORE').length;
  const afterCount = item.photos.filter((p) => p.phase === 'AFTER').length;
  return { beforeCount, afterCount };
}

export function InspectionItemCard({
  item,
  readOnly,
  busy,
  photoMode,
  onToggleNa,
  onUpload,
  onDeletePhoto,
}: {
  item: InspectionItem;
  readOnly: boolean;
  busy: boolean;
  photoMode: InspectionPhotoMode;
  onToggleNa: (na: boolean) => void;
  onUpload: (phase: 'BEFORE' | 'AFTER', files: FileList | null) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const { beforeCount, afterCount } = itemStats(item);
  const complete = isItemComplete({
    notApplicable: item.notApplicable,
    naReason: item.naReason,
    beforeCount,
    afterCount,
  });

  const showBefore = photoMode === 'before-only' || photoMode === 'both';
  const showAfter = photoMode === 'after-only' || photoMode === 'both';
  const beforeReadOnly = photoMode === 'after-only';
  const afterReadOnly = photoMode === 'before-only';

  return (
    <div
      className={`rounded-lg border p-2.5 ${complete ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100 bg-gray-50/50'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-fluid-xs font-medium text-gray-900">
          {item.label}
          {item.isCustom && <span className="ml-1 text-fluid-2xs font-normal text-blue-700">(추가)</span>}
        </span>
        {!readOnly && (photoMode === 'both' || photoMode === 'before-only') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleNa(!item.notApplicable)}
            className={`shrink-0 rounded-lg border px-2.5 py-1.5 min-h-[36px] text-fluid-2xs touch-manipulation sm:min-h-0 sm:px-1.5 sm:py-0.5 sm:text-[10px] ${
              item.notApplicable
                ? 'border-amber-600 bg-amber-50 text-amber-900'
                : 'border-gray-300 bg-white text-gray-600'
            }`}
          >
            해당없음
          </button>
        )}
      </div>

      {item.notApplicable ? (
        <div className="mt-1.5 space-y-1">
          <p className="text-[10px] text-amber-900/90 leading-snug">{INSPECTION_NA_CUSTOMER_NOTICE}</p>
          <p className="text-fluid-2xs text-gray-700">{formatInspectionNaReason(item.naReason)}</p>
        </div>
      ) : (
        <div className={`mt-2 grid gap-2 ${showBefore && showAfter ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {showBefore &&
            renderPhotoColumn({
              phase: 'BEFORE',
              label: '청소 전',
              items: item.photos.filter((p) => p.phase === 'BEFORE'),
              readOnly: readOnly || beforeReadOnly,
              busy,
              onUpload,
              onDeletePhoto,
            })}
          {showAfter &&
            renderPhotoColumn({
              phase: 'AFTER',
              label: '청소 후',
              items: item.photos.filter((p) => p.phase === 'AFTER'),
              readOnly: readOnly || afterReadOnly,
              busy,
              onUpload,
              onDeletePhoto,
            })}
        </div>
      )}
    </div>
  );
}

function renderPhotoColumn(params: {
  phase: 'BEFORE' | 'AFTER';
  label: string;
  items: InspectionItem['photos'];
  readOnly: boolean;
  busy: boolean;
  onUpload: (phase: 'BEFORE' | 'AFTER', files: FileList | null) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-fluid-2xs font-medium text-gray-600 sm:text-fluid-xs">{params.label}</span>
        {!params.readOnly && (
          <label className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-blue-600 bg-blue-50 px-4 py-2.5 text-fluid-xs font-semibold text-blue-900 shadow-sm touch-manipulation active:scale-[0.98] has-[:disabled]:opacity-50 sm:min-h-[36px] sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-fluid-2xs sm:font-medium">
            사진 추가
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              disabled={params.busy}
              onChange={(e) => {
                params.onUpload(params.phase, e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {params.items.map((p) => (
          <div key={p.id} className="relative">
            <img src={p.secureUrl} alt={params.label} className="h-20 w-20 rounded-lg object-cover border border-gray-200 sm:h-16 sm:w-16" />
            {!params.readOnly && (
              <button
                type="button"
                disabled={params.busy}
                onClick={() => params.onDeletePhoto(p.id)}
                className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/85 text-xs font-bold text-white touch-manipulation sm:h-5 sm:w-5 sm:text-[10px]"
                aria-label="사진 삭제"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!params.items.length && <span className="text-fluid-2xs text-gray-400 py-2">없음</span>}
      </div>
    </div>
  );
}

export function InspectionAreaSection({
  area,
  readOnly,
  busy,
  photoMode,
  defaultOpen,
  onToggleAreaNa,
  onAddItem,
  customItemLabel,
  onCustomItemLabelChange,
  onToggleItemNa,
  onUpload,
  onDeletePhoto,
  areaShareAction,
}: {
  area: InspectionArea;
  readOnly: boolean;
  busy: boolean;
  photoMode: InspectionPhotoMode;
  defaultOpen?: boolean;
  onToggleAreaNa?: (na: boolean) => void;
  onAddItem?: () => void;
  customItemLabel?: string;
  onCustomItemLabelChange?: (v: string) => void;
  onToggleItemNa: (itemId: string, na: boolean) => void;
  onUpload: (itemId: string, phase: 'BEFORE' | 'AFTER', files: FileList | null) => void;
  onDeletePhoto: (itemId: string, photoId: string) => void;
  /** 청소 전 구역 사진 카톡 전달 등 */
  areaShareAction?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const visibleItems = area.items.filter((it) => !it.itemKey.startsWith('_'));
  const progress = countItemPhotoProgress(
    visibleItems.map((it) => {
      const { beforeCount, afterCount } = itemStats(it);
      return {
        notApplicable: it.notApplicable,
        naReason: it.naReason,
        beforeCount,
        afterCount,
      };
    }),
  );

  const progressLabel =
    photoMode === 'before-only'
      ? `청소 전 ${progress.beforeDone}/${progress.total}`
      : photoMode === 'after-only'
        ? `청소 후 ${progress.afterDone}/${progress.total}`
        : `전 ${progress.beforeDone} · 후 ${progress.afterDone} / ${progress.total}`;

  const areaComplete =
    area.notApplicable ||
    (visibleItems.length > 0 &&
      visibleItems.every((it) => {
        const { beforeCount, afterCount } = itemStats(it);
        return isItemComplete({
          notApplicable: it.notApplicable,
          naReason: it.naReason,
          beforeCount,
          afterCount,
        });
      }));

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className={`rounded-xl border ${areaComplete ? 'border-emerald-200 bg-emerald-50/20' : 'border-gray-200 bg-white'}`}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 touch-manipulation">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-fluid-sm font-semibold text-gray-900">
            {area.label}
            {area.isCustom && <span className="ml-1 text-fluid-2xs font-normal text-blue-700">(추가)</span>}
          </span>
          <span className="text-fluid-2xs text-gray-600">{progressLabel}</span>
        </div>
      </summary>

      <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2">
        {areaShareAction ? <div>{areaShareAction}</div> : null}
        {!readOnly && onToggleAreaNa && photoMode !== 'after-only' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleAreaNa(!area.notApplicable)}
            className={`rounded-lg border px-2 py-1 text-fluid-2xs touch-manipulation ${
              area.notApplicable
                ? 'border-amber-600 bg-amber-50 text-amber-900'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            구역 전체 해당사항 없음
          </button>
        )}

        {area.notApplicable ? (
          <p className="text-fluid-2xs text-amber-900">{formatInspectionNaReason(area.naReason)}</p>
        ) : (
          <>
            {visibleItems.map((item) => (
              <InspectionItemCard
                key={item.id}
                item={item}
                readOnly={readOnly}
                busy={busy}
                photoMode={photoMode}
                onToggleNa={(na) => onToggleItemNa(item.id, na)}
                onUpload={(phase, files) => onUpload(item.id, phase, files)}
                onDeletePhoto={(photoId) => onDeletePhoto(item.id, photoId)}
              />
            ))}

            {!visibleItems.length && (
              <p className="text-fluid-2xs text-gray-500">세부 항목이 없습니다. 아래에서 항목을 추가해 주세요.</p>
            )}

            {!readOnly && area.isCustom && onAddItem && (
              <div className="flex flex-wrap gap-2 pt-1">
                <input
                  value={customItemLabel ?? ''}
                  onChange={(e) => onCustomItemLabelChange?.(e.target.value)}
                  placeholder="세부 항목 이름"
                  className="flex-1 min-w-[8rem] rounded-lg border border-gray-300 px-2 py-1 text-fluid-2xs"
                />
                <button
                  type="button"
                  disabled={busy || !customItemLabel?.trim()}
                  onClick={onAddItem}
                  className="rounded-lg border border-blue-600 bg-blue-50 px-2 py-1 text-fluid-2xs text-blue-900 disabled:opacity-50"
                >
                  항목 추가
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

export function InspectionBasicSection({
  checklist,
  readOnly,
  onPatch,
}: {
  checklist: InspectionChecklistDto;
  readOnly: boolean;
  onPatch: (basicAnswers: InspectionChecklistDto['basicAnswers']) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-fluid-sm font-semibold text-gray-900">기본사항</h3>
      <div className="space-y-3">
        {INSPECTION_BASIC_QUESTIONS.map((q) => (
          <div key={q.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
            <p className="text-fluid-xs text-gray-900 mb-2">{q.text}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <YesNoToggle
                label="팀장"
                value={checklist.basicAnswers[q.id].leader}
                disabled={readOnly}
                onChange={(v) =>
                  onPatch({
                    ...checklist.basicAnswers,
                    [q.id]: { ...checklist.basicAnswers[q.id], leader: v },
                  })
                }
              />
              <YesNoToggle
                label="고객"
                value={checklist.basicAnswers[q.id].customer}
                disabled={readOnly}
                onChange={(v) =>
                  onPatch({
                    ...checklist.basicAnswers,
                    [q.id]: { ...checklist.basicAnswers[q.id], customer: v },
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InspectionConsentSection({
  checklist,
  readOnly,
  onConsentChange,
  onEmailChange,
}: {
  checklist: InspectionChecklistDto;
  readOnly: boolean;
  onConsentChange: (key: keyof InspectionChecklistDto['consent'], value: boolean) => void;
  onEmailChange: (email: string) => void;
}) {
  const consentKeyMap: Record<string, keyof InspectionChecklistDto['consent']> = {
    F1: 'personalInfo',
    F2: 'thirdParty',
    F3: 'scopeConfirm',
    F4_LEADER: 'leaderLiability',
    F4_CUSTOMER: 'customerConfirm',
    F5: 'commercialUse',
    EMAIL: 'emailDelivery',
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-fluid-sm font-semibold text-gray-900">고객 이메일 · 동의</h3>
        <label className="mt-2 block text-fluid-xs text-gray-700">완료본 수신 이메일</label>
        <input
          type="email"
          value={checklist.customerEmail ?? ''}
          readOnly={readOnly}
          onChange={(e) => onEmailChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
          placeholder="customer@example.com"
        />
      </div>

      {INSPECTION_CONSENT_ITEMS.map((item) => {
        const key = consentKeyMap[item.id];
        if (!key) return null;
        const checked = checklist.consent[key];
        return (
          <details key={item.id} className="rounded-lg border border-gray-200 bg-white" open={item.required}>
            <summary className="cursor-pointer px-3 py-2 text-fluid-xs font-medium text-gray-900">
              {item.title}
              {item.required ? ' (필수)' : ' (선택)'}
            </summary>
            <div className="border-t border-gray-100 px-3 py-2">
              <p className="whitespace-pre-wrap text-fluid-2xs text-gray-700 mb-2">{item.body}</p>
              <label className="flex items-start gap-2 text-fluid-xs text-gray-900">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={(e) => onConsentChange(key, e.target.checked)}
                  className="mt-0.5"
                />
                <span>{item.checkboxLabel}</span>
              </label>
            </div>
          </details>
        );
      })}

      <p className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-fluid-2xs text-blue-950 whitespace-pre-wrap">
        {INSPECTION_FINAL_CONFIRM_NOTICE}
      </p>
    </section>
  );
}

export function InspectionHeaderBlock({
  checklist,
  title = '청소 서비스 현장 검수 체크리스트',
  intro = INSPECTION_HEADER_INTRO,
}: {
  checklist: InspectionChecklistDto;
  title?: string;
  intro?: string;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
      <h2 className="text-fluid-base font-bold text-blue-950">{title}</h2>
      <p className="mt-2 text-fluid-xs text-blue-900/90">{intro}</p>
      <dl className="mt-3 grid gap-1 text-fluid-xs text-gray-800 sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">고객명</dt>
          <dd className="font-medium">{checklist.inquiryHeader?.customerName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">서비스일</dt>
          <dd className="font-medium">{checklist.inquiryHeader?.preferredDate ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">담당 팀장</dt>
          <dd className="font-medium">{checklist.teamLeader.name}</dd>
        </div>
      </dl>
    </div>
  );
}

export {
  INSPECTION_AREA_GUIDE,
  INSPECTION_CUSTOM_AREA_GUIDE,
  INSPECTION_ITEM_GUIDE,
  INSPECTION_PRE_CLEAN_GUIDE,
};
