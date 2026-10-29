import { useState } from 'react';
import type { PublicSignFieldDto } from '../../api/eContractPublic';
import { LineMdIcon } from '../ui/LineMdIcon';
import { EContractDynamicFieldInputs } from './EContractDynamicFieldInputs';
import { splitEContractSignerAddressValue } from './eContractSignerAddressValue';
import { EC_SIGNER_ADDRESS_TOKEN } from '../../utils/eContractDisplay';

type Props = {
  fields: PublicSignFieldDto[];
  values: Record<string, string>;
  onChange: (token: string, value: string) => void;
  uploadToken: string;
  uploadBlob?: (blob: Blob, filename: string) => Promise<{ secureUrl: string }>;
  signatureAnchorId: string;
};

function fieldReady(field: PublicSignFieldDto, values: Record<string, string>): string | null {
  if (!field.required) return null;
  const raw = values[field.token] ?? '';
  if (field.inputType === 'CHECKBOX') {
    return raw === 'Y' ? null : `「${field.label}」에 체크해 주세요.`;
  }
  if (field.token === EC_SIGNER_ADDRESS_TOKEN) {
    const { base } = splitEContractSignerAddressValue(raw);
    return base.trim() ? null : '「주소 검색」으로 주소를 선택해 주세요.';
  }
  return raw.trim() ? null : `「${field.label}」을(를) 입력해 주세요.`;
}

export function EContractFillStepper({ fields, values, onChange, uploadToken, uploadBlob, signatureAnchorId }: Props) {
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const current = fields[index];
  if (!current) return null;
  const step = index + 1;

  const go = (nextIndex: number) => {
    setHint(null);
    setIndex(nextIndex);
  };

  const onNext = () => {
    const problem = fieldReady(current, values);
    if (problem) {
      setHint(problem);
      return;
    }
    if (index >= fields.length - 1) {
      document.getElementById(signatureAnchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    go(index + 1);
  };

  const change = (token: string, value: string) => {
    const field = fields.find((f) => f.token === token);
    if (field?.inputType === 'SEAL') {
      for (const f of fields) {
        if (f.inputType === 'SEAL') onChange(f.token, value);
      }
      return;
    }
    onChange(token, value);
  };

  return (
    <div className="mt-4">
      <p className="text-fluid-2xs tabular-nums text-slate-500">
        {step} / {fields.length}
      </p>
      <div className="mt-3">
        <EContractDynamicFieldInputs
          fields={[current]}
          values={values}
          onChange={change}
          uploadToken={uploadToken}
          uploadBlob={uploadBlob}
          idPrefix="ec-sign-step"
        />
      </div>
      {hint ? <p className="mt-3 text-fluid-2xs text-red-700">{hint}</p> : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <LineMdIcon name="chevron-left" className="size-4" />
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {index >= fields.length - 1 ? '서명으로' : '다음'}
          <LineMdIcon name="chevron-right" className="size-4" />
        </button>
      </div>
    </div>
  );
}
