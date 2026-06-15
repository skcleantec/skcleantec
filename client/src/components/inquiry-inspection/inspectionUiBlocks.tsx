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
  const showSplit = showBefore && showAfter;
  const beforeReadOnly = readOnly || photoMode === 'after-only';
  const afterReadOnly = readOnly || photoMode === 'before-only';

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        complete ? 'border-emerald-300 bg-white shadow-sm' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <span className="min-w-0 truncate text-fluid-xs font-semibold text-gray-900">
          {item.label}
          {item.isCustom && <span className="ml-1 text-fluid-2xs font-normal text-blue-700">(추가)</span>}
        </span>
        {!readOnly && (photoMode === 'both' || photoMode === 'before-only') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleNa(!item.notApplicable)}
            className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium touch-manipulation ${
              item.notApplicable
                ? 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-gray-300 bg-gray-50 text-gray-600'
            }`}
          >
            해당없음
          </button>
        )}
      </div>

      {item.notApplicable ? (
        <div className="space-y-1 bg-amber-50/40 px-3 py-2.5">
          <p className="text-[10px] leading-snug text-amber-900/90">{INSPECTION_NA_CUSTOMER_NOTICE}</p>
          <p className="text-fluid-2xs text-gray-700">{formatInspectionNaReason(item.naReason)}</p>
        </div>
      ) : showSplit ? (
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          {renderPhotoColumn({
            phase: 'BEFORE',
            label: '청소 전',
            items: item.photos.filter((p) => p.phase === 'BEFORE'),
            readOnly: beforeReadOnly,
            busy,
            split: true,
            onUpload,
            onDeletePhoto,
          })}
          {renderPhotoColumn({
            phase: 'AFTER',
            label: '청소 후',
            items: item.photos.filter((p) => p.phase === 'AFTER'),
            readOnly: afterReadOnly,
            busy,
            split: true,
            onUpload,
            onDeletePhoto,
          })}
        </div>
      ) : (
        <div className="p-2">
          {showBefore &&
            renderPhotoColumn({
              phase: 'BEFORE',
              label: '청소 전',
              items: item.photos.filter((p) => p.phase === 'BEFORE'),
              readOnly: beforeReadOnly,
              busy,
              split: false,
              onUpload,
              onDeletePhoto,
            })}
          {showAfter &&
            renderPhotoColumn({
              phase: 'AFTER',
              label: '청소 후',
              items: item.photos.filter((p) => p.phase === 'AFTER'),
              readOnly: afterReadOnly,
              busy,
              split: false,
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
  split: boolean;
  onUpload: (phase: 'BEFORE' | 'AFTER', files: FileList | null) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const isBefore = params.phase === 'BEFORE';
  const hasPhotos = params.items.length > 0;
  const headerTone = isBefore
    ? 'border-sky-100 bg-sky-50 text-sky-800'
    : 'border-emerald-100 bg-emerald-50 text-emerald-800';
  const emptyTone = isBefore
    ? 'border-sky-200/70 bg-sky-50/40 text-sky-600/70'
    : 'border-emerald-200/70 bg-emerald-50/40 text-emerald-600/70';
  const addTone = isBefore
    ? 'border-sky-200 bg-sky-50/50 text-sky-800 hover:bg-sky-100/80'
    : 'border-emerald-200 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/80';

  return (
    <div className={`flex min-w-0 flex-col ${params.split ? 'min-h-[7.5rem]' : ''}`}>
      <div
        className={`border-b px-2 py-1.5 text-center text-[10px] font-bold tracking-wide ${headerTone}`}
      >
        {params.label}
        {hasPhotos ? (
          <span className="ml-1 font-normal opacity-80">({params.items.length})</span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${params.split ? 'p-1.5' : 'mt-1.5'}`}>
        {hasPhotos ? (
          <div className="grid grid-cols-2 gap-1.5">
            {params.items.map((p) => (
              <div key={p.id} className="relative aspect-square min-w-0">
                <img
                  src={p.secureUrl}
                  alt={params.label}
                  className="h-full w-full rounded-md border border-gray-200/80 object-cover"
                />
                {!params.readOnly && (
                  <button
                    type="button"
                    disabled={params.busy}
                    onClick={() => params.onDeletePhoto(p.id)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/90 text-[10px] font-bold text-white touch-manipulation"
                    aria-label="사진 삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`flex flex-1 items-center justify-center rounded-md border border-dashed px-2 py-4 text-[10px] ${emptyTone}`}
          >
            없음
          </div>
        )}
      </div>

      {!params.readOnly && (
        <label
          className={`mx-1.5 mb-1.5 flex cursor-pointer items-center justify-center rounded-md border py-1.5 text-[10px] font-semibold touch-manipulation active:scale-[0.98] has-[:disabled]:opacity-50 ${addTone} ${params.split ? '' : 'mt-1'}`}
        >
          + 사진 추가
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
  customerEmail,
  onEmailBlur,
  onEmailFocus,
}: {
  checklist: InspectionChecklistDto;
  readOnly: boolean;
  onConsentChange: (key: keyof InspectionChecklistDto['consent'], value: boolean) => void;
  onEmailChange: (email: string) => void;
  /** 입력 중 리렌더 지연 방지 — 부모 로컬 state 연결 */
  customerEmail?: string;
  onEmailBlur?: (email: string) => void;
  onEmailFocus?: () => void;
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
          inputMode="email"
          value={customerEmail ?? checklist.customerEmail ?? ''}
          readOnly={readOnly}
          onChange={(e) => onEmailChange(e.target.value)}
          onFocus={onEmailFocus}
          onBlur={onEmailBlur ? (e) => onEmailBlur(e.target.value) : undefined}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base touch-manipulation"
          placeholder="customer@example.com"
          autoComplete="email"
          enterKeyHint="done"
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
      <dl className="mt-3 grid grid-cols-3 gap-x-1.5 gap-y-0.5 text-[10px] leading-snug text-gray-800 sm:gap-x-2 sm:text-fluid-xs">
        <div className="min-w-0">
          <dt className="text-gray-500">고객명</dt>
          <dd className="truncate font-medium">{checklist.inquiryHeader?.customerName ?? '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500">서비스일</dt>
          <dd className="truncate font-medium">{checklist.inquiryHeader?.preferredDate ?? '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500">담당 팀장</dt>
          <dd className="truncate font-medium">{checklist.teamLeader.name}</dd>
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
