import { INQUIRY_EXCEL_FIELD_CATALOG } from '@shared/inquiryExcelImportFields';
import { buildInquiryExcelFieldGroups, fieldHintByKey } from '../../../utils/inquiryExcelMappingUi';

type Props = {
  value: string;
  onChange: (fieldKey: string) => void;
  disabledFieldKeys?: Set<string>;
  headersUsedInMemoLines?: Set<string>;
  className?: string;
  id?: string;
};

export function InquiryExcelFieldSelect({
  value,
  onChange,
  disabledFieldKeys,
  headersUsedInMemoLines: _headersUsedInMemoLines,
  className,
  id,
}: Props) {
  const groups = buildInquiryExcelFieldGroups();
  const fieldMap = new Map(INQUIRY_EXCEL_FIELD_CATALOG.map((f) => [f.key, f]));

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-fluid-xs'}
    >
      <option value="">— 연결 안 함 —</option>
      {groups.map((group) => {
        const fields = group.fieldKeys
          .map((key) => fieldMap.get(key))
          .filter((f): f is NonNullable<typeof f> => Boolean(f));
        if (fields.length === 0) return null;
        return (
          <optgroup key={group.id} label={group.label}>
            {fields.map((f) => (
              <option key={f.key} value={f.key} disabled={disabledFieldKeys?.has(f.key)}>
                {f.label}
                {f.required ? ' *' : ''}
                {disabledFieldKeys?.has(f.key) && f.key !== value ? ' (다른 열에 연결됨)' : ''}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

export function InquiryExcelFieldHint({ fieldKey }: { fieldKey: string }) {
  const hint = fieldHintByKey(fieldKey);
  if (!hint) return null;
  return <p className="mt-1 text-fluid-2xs text-slate-500">{hint}</p>;
}
