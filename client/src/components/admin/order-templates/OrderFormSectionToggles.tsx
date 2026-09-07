import { HelpTooltip } from '../../ui/HelpTooltip';
import { ORDER_FORM_PHOTOS_SECTION_KEY } from '@shared/orderFormSectionToggles';

const SWITCH_BTN =
  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

export const ORDER_FORM_SECTION_TOGGLES_HELP =
  '끄면 고객 발주서에 사진을 올리는 칸이 없어집니다. 이미 보낸 링크도 다음에 열면 같이 적용됩니다. 저장해야 반영됩니다.';

type Props = {
  photosOn: boolean;
  onPhotosChange: (on: boolean) => void;
  disabled?: boolean;
};

export function OrderFormSectionToggles({ photosOn, onPhotosChange, disabled }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 sm:p-3">
      <p className="mb-2 text-fluid-xs font-medium text-slate-800">고객에게 보일 섹션</p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-fluid-xs text-slate-900">현장 사진 첨부</span>
            <HelpTooltip className="shrink-0" text={ORDER_FORM_SECTION_TOGGLES_HELP} />
          </div>
          <p className="mt-0.5 text-fluid-2xs text-slate-500">고객 발주서에 사진 올리는 칸을 보여 줍니다.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={photosOn}
          aria-label="현장 사진 첨부"
          disabled={disabled}
          onClick={() => onPhotosChange(!photosOn)}
          className={`${SWITCH_BTN} ${
            photosOn ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-300 hover:bg-slate-400'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              photosOn ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <p className="sr-only" data-section-key={ORDER_FORM_PHOTOS_SECTION_KEY}>
        {photosOn ? '켜짐' : '꺼짐'}
      </p>
    </div>
  );
}
