import { guideItemsToEditorText } from '../../utils/orderGuideSectionDraft';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';

const BTN_SAVE =
  'rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const BTN_GHOST =
  'text-sm text-red-600 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 rounded-sm disabled:opacity-50 disabled:pointer-events-none';

export function OrderGuideSectionCard(props: {
  section: GuideSection;
  dirty: boolean;
  saving: boolean;
  canRemove?: boolean;
  onTitleChange: (title: string) => void;
  onItemsTextChange: (text: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { section, dirty, saving, canRemove = true, onTitleChange, onItemsTextChange, onSave, onRemove } = props;
  const itemsText = guideItemsToEditorText(section.items);

  return (
    <section className="p-4 bg-white border border-gray-200 rounded-lg space-y-3">
      <div className="flex items-start justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700 flex-1 min-w-0">
          섹션 제목
          <input
            type="text"
            className="mt-1 w-full min-h-9 px-3 py-2 border border-gray-300 rounded text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            value={section.title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </label>
        {canRemove ? (
          <button type="button" onClick={onRemove} className={`${BTN_GHOST} shrink-0 mt-7`} disabled={saving}>
            삭제
          </button>
        ) : null}
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">
          항목 · Enter로 줄 바꿈 (한 줄이 고객 화면의 한 항목)
        </label>
        <textarea
          rows={Math.max(6, section.items.length + 2)}
          className="w-full resize-y min-h-[8rem] px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 font-mono leading-relaxed whitespace-pre-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          value={itemsText}
          onChange={(e) => onItemsTextChange(e.target.value)}
          placeholder={'첫 번째 안내\n두 번째 안내'}
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" className={BTN_SAVE} disabled={saving} onClick={onSave}>
          {saving ? '저장 중…' : '이 섹션 저장'}
        </button>
        {dirty ? (
          <span className="text-fluid-2xs text-amber-800">수정됨 · 저장해야 고객 화면에 반영됩니다</span>
        ) : (
          <span className="text-fluid-2xs text-gray-400">저장됨</span>
        )}
      </div>
    </section>
  );
}
