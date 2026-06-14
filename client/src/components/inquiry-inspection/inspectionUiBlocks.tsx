import {
  INSPECTION_AREA_GUIDE,
  INSPECTION_BASIC_QUESTIONS,
  INSPECTION_CUSTOM_AREA_GUIDE,
  INSPECTION_HEADER_INTRO,
  INSPECTION_NA_CUSTOMER_NOTICE,
  isAreaComplete,
} from '@shared/inquiryInspectionTemplate';
import {
  INSPECTION_CONSENT_ITEMS,
  INSPECTION_FINAL_CONFIRM_NOTICE,
} from '@shared/inquiryInspectionConsent';
import type { InspectionArea, InspectionChecklistDto } from '../../api/inquiryInspection';

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

export function InspectionAreaCard({
  area,
  readOnly,
  busy,
  onToggleNa,
  onNaReasonChange,
  onUpload,
  onDeletePhoto,
}: {
  area: InspectionArea;
  readOnly: boolean;
  busy: boolean;
  onToggleNa: (na: boolean, reason?: string) => void;
  onNaReasonChange: (reason: string) => void;
  onUpload: (phase: 'BEFORE' | 'AFTER', files: FileList | null) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const before = area.photos.filter((p) => p.phase === 'BEFORE');
  const after = area.photos.filter((p) => p.phase === 'AFTER');
  const complete = isAreaComplete({
    notApplicable: area.notApplicable,
    naReason: area.naReason,
    beforeCount: before.length,
    afterCount: after.length,
  });

  return (
    <div
      className={`rounded-xl border p-3 ${complete ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-white'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-fluid-sm font-semibold text-gray-900">
          {area.label}
          {area.isCustom && <span className="ml-1 text-fluid-2xs font-normal text-blue-700">(추가)</span>}
        </h4>
        {!readOnly && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleNa(!area.notApplicable)}
            className={`rounded-lg border px-2 py-1 text-fluid-2xs touch-manipulation ${
              area.notApplicable
                ? 'border-amber-600 bg-amber-50 text-amber-900'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            해당사항 없음
          </button>
        )}
      </div>

      {area.notApplicable ? (
        <div className="mt-2 space-y-2">
          <p className="text-fluid-2xs text-amber-900/90">{INSPECTION_NA_CUSTOMER_NOTICE}</p>
          {!readOnly && (
            <textarea
              value={area.naReason ?? ''}
              onChange={(e) => onNaReasonChange(e.target.value)}
              rows={2}
              placeholder="사유를 입력해 주세요 (필수)"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-fluid-xs"
            />
          )}
          {readOnly && area.naReason && (
            <p className="text-fluid-xs text-gray-700 whitespace-pre-wrap">{area.naReason}</p>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['BEFORE', 'AFTER'] as const).map((phase) => {
            const items = phase === 'BEFORE' ? before : after;
            const label = phase === 'BEFORE' ? '청소 전' : '청소 후';
            return (
              <div key={phase} className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-fluid-xs font-medium text-gray-700">{label}</span>
                  {!readOnly && (
                    <label className="cursor-pointer rounded-lg border border-blue-600 bg-blue-50 px-2 py-1 text-fluid-2xs text-blue-900 touch-manipulation">
                      사진 추가
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => {
                          onUpload(phase, e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((p) => (
                    <div key={p.id} className="relative">
                      <img src={p.secureUrl} alt={label} className="h-20 w-20 rounded-lg object-cover border" />
                      {!readOnly && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDeletePhoto(p.id)}
                          className="absolute -right-1 -top-1 rounded-full bg-gray-900/80 px-1.5 text-[10px] text-white"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {!items.length && <span className="text-fluid-2xs text-gray-400">사진 없음</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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

export function InspectionHeaderBlock({ checklist }: { checklist: InspectionChecklistDto }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
      <h2 className="text-fluid-base font-bold text-blue-950">청소 서비스 현장 검수 체크리스트</h2>
      <p className="mt-2 text-fluid-xs text-blue-900/90">{INSPECTION_HEADER_INTRO}</p>
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

export { INSPECTION_AREA_GUIDE, INSPECTION_CUSTOM_AREA_GUIDE };
