import { useMemo, useState } from 'react';
import { extraWorkNoticeCopy, type CustomerPageCopy } from '@shared/orderFormCustomerPages';
import { ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE } from '@shared/orderFormConsents';
import { OrderFormExtraWorkConsentModal } from '../../orderform/OrderFormExtraWorkConsentModal';

const INPUT =
  'w-full min-h-9 rounded-lg border border-slate-300 px-2.5 py-1.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const BTN =
  'inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const FIELDS: Array<{ key: string; label: string; multiline?: boolean; rows?: number }> = [
  { key: 'extraTitle', label: '팝업 제목' },
  { key: 'extraSubtitle', label: '팝업 부제' },
  { key: 'extraBody', label: '본문', multiline: true },
  { key: 'extraCasesTitle', label: '사례 제목' },
  { key: 'extraCases', label: '발생 사례 (한 줄에 하나)', multiline: true, rows: 6 },
  { key: 'extraCallout', label: '강조 안내', multiline: true },
  { key: 'extraPhoto', label: '사진 안내', multiline: true },
  { key: 'extraConsent', label: '동의 문장', multiline: true },
];

function lineText(page: CustomerPageCopy, key: string): string {
  return page.lines.find((line) => line.key === key)?.text ?? '';
}

export function OrderFormReviewExtraWorkSettings(props: {
  page: CustomerPageCopy;
  onChange: (lines: CustomerPageCopy['lines']) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const copy = useMemo(() => extraWorkNoticeCopy(props.page), [props.page]);

  const setLine = (key: string, text: string) => {
    const lines = props.page.lines.some((line) => line.key === key)
      ? props.page.lines.map((line) => (line.key === key ? { ...line, text } : line))
      : [...props.page.lines, { key, text }];
    props.onChange(lines);
  };

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/40 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-xs font-semibold text-slate-900">추가 시공비 안내 팝업</p>
        <button type="button" className={BTN} onClick={() => setPreviewOpen(true)}>
          미리보기
        </button>
      </div>
      <p className="text-fluid-2xs leading-snug text-slate-600">
        발급할 때 추가 시공비 안내를 체크한 발주서만 이 팝업이 나갑니다. 고객은 아래에 「
        {ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE}」라고 적어야 다음으로 갑니다.
      </p>
      {FIELDS.map((field) => (
        <label key={field.key} className="block space-y-1">
          <span className="text-fluid-2xs font-medium text-slate-600">{field.label}</span>
          {field.multiline ? (
            <textarea
              value={lineText(props.page, field.key)}
              rows={field.rows ?? 3}
              onChange={(e) => setLine(field.key, e.target.value)}
              className={INPUT}
            />
          ) : (
            <input
              value={lineText(props.page, field.key)}
              onChange={(e) => setLine(field.key, e.target.value)}
              className={INPUT}
            />
          )}
        </label>
      ))}
      <OrderFormExtraWorkConsentModal
        open={previewOpen}
        copy={copy}
        onClose={() => setPreviewOpen(false)}
        onConfirm={() => setPreviewOpen(false)}
      />
    </div>
  );
}
