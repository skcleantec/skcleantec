import { useCallback, useEffect, useRef } from 'react';
import { OrderFormModalTextToolbar } from './OrderFormModalTextToolbar';
import {
  orderFormModalMarkupToEditorHtml,
  serializeOrderFormModalEditorRoot,
} from '../../utils/orderFormModalVisualEditor';

const EDITOR_CLS =
  'w-full min-h-[8rem] rounded-b-lg rounded-t-none border border-t-0 border-gray-300 bg-white px-2 py-2 text-fluid-sm leading-relaxed text-gray-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 break-words [&_strong]:font-bold';

export function OrderFormModalTextEditor({
  label,
  value,
  onChange,
  minHeightClassName = 'min-h-[8rem]',
  onSave,
  saving = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  minHeightClassName?: string;
  onSave?: (markup: string) => void | Promise<void>;
  saving?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef(value);
  const isFocusedRef = useRef(false);

  const syncEditorFromMarkup = useCallback((markup: string) => {
    const el = editorRef.current;
    if (!el) return;
    const html = orderFormModalMarkupToEditorHtml(markup);
    el.innerHTML = html || '<br>';
  }, []);

  const readMarkupFromEditor = useCallback((): string => {
    const el = editorRef.current;
    if (!el) return value;
    return serializeOrderFormModalEditorRoot(el);
  }, [value]);

  const emitFromEditor = useCallback(() => {
    const markup = readMarkupFromEditor();
    lastEmittedRef.current = markup;
    onChange(markup);
  }, [onChange, readMarkupFromEditor]);

  const handleSave = useCallback(() => {
    const markup = readMarkupFromEditor();
    lastEmittedRef.current = markup;
    onChange(markup);
    void onSave?.(markup);
  }, [onChange, onSave, readMarkupFromEditor]);

  useEffect(() => {
    if (isFocusedRef.current) return;
    syncEditorFromMarkup(value);
    lastEmittedRef.current = value;
  }, [value, syncEditorFromMarkup]);

  useEffect(() => {
    syncEditorFromMarkup(value);
    lastEmittedRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount: ref 연결 직후 기본 문구를 실제 글로 표시
  }, []);

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-fluid-xs font-medium text-gray-700">{label}</label>
      ) : null}
      <div className="overflow-hidden rounded-lg">
        <OrderFormModalTextToolbar
          editorRef={editorRef}
          onEdited={emitFromEditor}
          onSave={onSave ? handleSave : undefined}
          saving={saving}
        />
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline
          contentEditable
          suppressContentEditableWarning
          className={`${EDITOR_CLS} ${minHeightClassName}`}
          onInput={emitFromEditor}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            emitFromEditor();
          }}
        />
      </div>
    </div>
  );
}
