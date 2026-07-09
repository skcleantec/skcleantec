import { crmFieldCompactClass } from '../crmUi';
import { CrmHoverTextPreview } from '../CrmHoverTextPreview';

export function CrmRequestMemoField({
  value,
  onChange,
  disabled,
  highlight = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const flashRing = 'ring-2 ring-sky-400/80 ring-offset-1';

  return (
    <CrmHoverTextPreview text={value} label="숨고 요청 메모">
      <label className="block space-y-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          숨고 요청 메모
          {value.trim().length >= 40 ? (
            <span className="hidden font-normal text-sky-600 lg:inline">· 마우스를 올리면 전체 보기</span>
          ) : null}
        </span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="고객 요청 모달에서 가져온 상세"
          className={`${crmFieldCompactClass} min-h-[60px] resize-y ${highlight ? flashRing : ''}`}
          disabled={disabled}
        />
      </label>
    </CrmHoverTextPreview>
  );
}
