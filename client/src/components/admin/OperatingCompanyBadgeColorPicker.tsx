import {
  operatingCompanyBadgeColorOptions,
  type OperatingCompanyBadgeColorKey,
} from '../../utils/operatingCompanyBadgeColors';
import { OperatingCompanyBadge } from './OperatingCompanyBadge';

export function OperatingCompanyBadgeColorPicker({
  value,
  onChange,
  previewName,
  previewSlug,
  previewId,
}: {
  value: OperatingCompanyBadgeColorKey | '';
  onChange: (next: OperatingCompanyBadgeColorKey | '') => void;
  previewName: string;
  previewSlug?: string;
  previewId?: string;
}) {
  const options = operatingCompanyBadgeColorOptions();
  const previewLabel = previewName.trim() || '미리보기';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`rounded border px-2.5 py-1 text-xs ${
            value === ''
              ? 'border-gray-800 bg-gray-800 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          자동
        </button>
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            title={opt.key}
            aria-label={`색상 ${opt.key}`}
            onClick={() => onChange(opt.key)}
            className={`h-7 w-7 rounded-full border-2 ${opt.swatch} ${
              value === opt.key ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-400' : 'border-white shadow-sm'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="shrink-0">미리보기</span>
        <OperatingCompanyBadge
          company={{
            id: previewId,
            name: previewLabel,
            slug: previewSlug,
            badgeColorKey: value || null,
          }}
        />
      </div>
    </div>
  );
}
