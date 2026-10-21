import { useEffect, useRef } from 'react';

export type PgContractFieldDraft = {
  token: string;
  label: string;
  inputType: 'TEXT' | 'TEXTAREA' | 'DATE' | 'NUMBER' | 'PHONE' | 'CHECKBOX' | 'SEAL';
  required: boolean;
  sortOrder: number;
};

export const PG_CONTRACT_TYPE_LABEL: Record<PgContractFieldDraft['inputType'], string> = {
  TEXT: '한 줄',
  TEXTAREA: '여러 줄',
  DATE: '날짜',
  NUMBER: '숫자',
  PHONE: '연락처',
  CHECKBOX: '체크',
  SEAL: '도장',
};

const CHIP_OK =
  'inline-flex items-center rounded border border-dashed border-sky-500 bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-950';
const CHIP_MISS =
  'inline-flex items-center rounded border border-dashed border-amber-500 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-950';
const CHIP_ON =
  'inline-flex items-center rounded border-2 border-slate-900 bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-slate-950';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function looksLikeImage(value: string) {
  return /^(https:\/\/|blob:|data:image\/)/i.test(value.trim());
}

function slotHtml(
  token: string,
  fields: PgContractFieldDraft[],
  values: Record<string, string> | undefined,
  activeToken: string | null,
) {
  const field = fields.find((item) => item.token === token);
  const signature = token === '[[EC_SIGNATURE]]';
  const label = signature ? '서명' : field?.label || '지정 안 된 칸';
  const kind = signature ? '서명' : field ? PG_CONTRACT_TYPE_LABEL[field.inputType] : '칸 없음';
  const raw = (values?.[token] ?? '').trim();
  const cls = !signature && !field ? CHIP_MISS : activeToken === token ? CHIP_ON : CHIP_OK;
  if ((signature || token.includes('SEAL') || field?.inputType === 'SEAL') && looksLikeImage(raw)) {
    return `<img data-ec-token="${escapeHtml(token)}" src="${escapeHtml(raw)}" alt="${escapeHtml(label)}" class="inline-block h-16 w-16 object-contain align-middle" />`;
  }
  if (field?.inputType === 'CHECKBOX') {
    const mark = raw === 'Y' || raw === '■' ? '■' : '□';
    return `<span data-ec-token="${escapeHtml(token)}" class="${cls}">${mark} ${escapeHtml(label)}</span>`;
  }
  if (raw) {
    return `<span data-ec-token="${escapeHtml(token)}" class="${cls}">${escapeHtml(raw)}</span>`;
  }
  return `<span data-ec-token="${escapeHtml(token)}" class="${cls}">${escapeHtml(label)} · ${escapeHtml(kind)}</span>`;
}

export function contractPreviewHtml(
  bodyHtml: string,
  fields: PgContractFieldDraft[],
  activeToken: string | null,
  values?: Record<string, string>,
) {
  return bodyHtml.replace(/\[\[EC_[A-Z0-9_]+\]\]/g, (token) => slotHtml(token, fields, values, activeToken));
}

export function placeFieldInContract(bodyHtml: string, field: Pick<PgContractFieldDraft, 'token' | 'label'>) {
  if (bodyHtml.includes(field.token)) return bodyHtml;
  const line = `<p>${escapeHtml(field.label)} ${field.token}</p>`;
  return bodyHtml.trim() ? `${bodyHtml.trim()}\n${line}` : line;
}

type Props = {
  title: string;
  bodyHtml: string;
  fields: PgContractFieldDraft[];
  activeToken: string | null;
  values?: Record<string, string>;
  onSelect: (token: string) => void;
};

export function PgContractPreview({ title, bodyHtml, fields, activeToken, values, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeToken || !rootRef.current) return;
    const node = rootRef.current.querySelector(`[data-ec-token="${CSS.escape(activeToken)}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeToken, bodyHtml]);

  return (
    <div
      ref={rootRef}
      className="max-h-[32rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4"
      onClick={(event) => {
        const node = (event.target as HTMLElement).closest('[data-ec-token]');
        const token = node?.getAttribute('data-ec-token');
        if (token) onSelect(token);
      }}
    >
      <h2 className="text-base font-semibold text-slate-900">{title.trim() || '전자계약'}</h2>
      {bodyHtml.trim() ? (
        <div
          className="mt-3 space-y-2 text-sm leading-relaxed text-slate-800 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-2"
          dangerouslySetInnerHTML={{ __html: contractPreviewHtml(bodyHtml, fields, activeToken, values) }}
        />
      ) : (
        <p className="mt-3 text-sm text-slate-500">계약서 문구가 없습니다. 아래에서 문구를 넣으면 여기에 보입니다.</p>
      )}
    </div>
  );
}
