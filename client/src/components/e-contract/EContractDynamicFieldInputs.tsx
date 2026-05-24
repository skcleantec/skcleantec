import type { PublicSignFieldDto } from '../../api/eContractPublic';
import type { EContractFieldInputTypeKind } from '../../api/adminEContract';
import { EC_SIGNER_ADDRESS_TOKEN } from '../../utils/eContractDisplay';
import { EContractSignerAddressInput } from './EContractSignerAddressInput';

type FieldLike = Pick<PublicSignFieldDto, 'token' | 'label' | 'inputType' | 'required'> & { prefill?: string };

type Props = {
  fields: FieldLike[];
  values: Record<string, string>;
  onChange: (token: string, value: string) => void;
  idPrefix?: string;
};

function inputId(prefix: string, token: string): string {
  return `${prefix}-${token.replace(/[^\w]/g, '_')}`;
}

export function EContractDynamicFieldInputs({ fields, values, onChange, idPrefix = 'ec-field' }: Props) {
  if (fields.length === 0) return null;

  return (
    <div className="min-w-0 space-y-4">
      {fields.map((f) => {
        const id = inputId(idPrefix, f.token);
        const val = values[f.token] ?? '';
        const label = (
          <>
            {f.label}
            {!f.required ? <span className="font-normal text-gray-500"> (선택)</span> : null}
          </>
        );

        if (f.token === EC_SIGNER_ADDRESS_TOKEN) {
          return (
            <EContractSignerAddressInput
              key={f.token}
              id={id}
              label={label}
              value={val}
              required={f.required}
              onChange={(next) => onChange(f.token, next)}
            />
          );
        }

        if (f.inputType === 'TEXTAREA') {
          return (
            <div key={f.token}>
              <label htmlFor={id} className="block text-fluid-xs font-medium text-gray-800">
                {label}
              </label>
              <textarea
                id={id}
                rows={3}
                value={val}
                onChange={(ev) => onChange(f.token, ev.target.value)}
                className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-fluid-xs"
                maxLength={4000}
              />
            </div>
          );
        }

        const inputMode: 'text' | 'numeric' | 'tel' | 'decimal' =
          f.inputType === 'RRN' || f.inputType === 'NUMBER'
            ? 'numeric'
            : f.inputType === 'PHONE'
              ? 'tel'
              : 'text';

        return (
          <div key={f.token}>
            <label htmlFor={id} className="block text-fluid-xs font-medium text-gray-800">
              {label}
              {f.inputType === 'RRN' ? (
                <span className="font-normal text-gray-500"> (숫자 13자리)</span>
              ) : null}
            </label>
            <input
              id={id}
              type={f.inputType === 'DATE' ? 'date' : 'text'}
              inputMode={f.inputType === 'DATE' ? undefined : inputMode}
              value={val}
              onChange={(ev) => {
                let next = ev.target.value;
                if (f.inputType === 'RRN') next = next.replace(/\D/g, '').slice(0, 13);
                onChange(f.token, next);
              }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              maxLength={f.inputType === 'RRN' ? 13 : f.inputType === 'PHONE' ? 32 : 2000}
            />
          </div>
        );
      })}
    </div>
  );
}

export function emptyFieldValues(fields: FieldLike[], prefill?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    out[f.token] = prefill?.[f.token]?.trim() ?? f.prefill?.trim() ?? '';
  }
  return out;
}

export function eContractFieldInputTypeLabel(t: EContractFieldInputTypeKind): string {
  switch (t) {
    case 'TEXTAREA':
      return '여러 줄';
    case 'DATE':
      return '날짜';
    case 'NUMBER':
      return '숫자';
    case 'PHONE':
      return '연락처';
    case 'RRN':
      return '주민번호';
    default:
      return '한 줄';
  }
}
