import { useRef, useState } from 'react';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
};

/** 표·칸·배경이 있는 HTML 소스를 에디터가 걷어내지 않게 넣는다 */
export function HelpCmsHtmlSourceInsert({ open, onClose, onInsert }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  if (!open) return null;

  return (
    <div
      ref={scrollRef}
      className="modal-form-scroll-surface space-y-2 border-b border-slate-200 bg-white px-3 py-2"
      onFocusCapture={onFieldFocus}
    >
      <p className="text-fluid-2xs text-slate-600">
        HTML 파일 내용이나 표가 있는 페이지 코드를 아래에 붙여 넣은 뒤 「본문에 넣기」를 누르세요.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder="<!DOCTYPE html> … 또는 <table> …"
        className="login-field-input w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-fluid-2xs text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            const html = draft.trim();
            if (!html) return;
            onInsert(html);
            setDraft('');
          }}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          본문에 넣기
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft('');
            onClose();
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
