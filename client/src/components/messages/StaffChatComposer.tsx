import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { resizeStaffChatComposer, shouldStaffChatEnterSend } from '../../utils/staffChatComposer';

type StaffChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
  sending?: boolean;
  disabled?: boolean;
  placeholder: string;
  sendLabel: ReactNode;
  error?: string | null;
  variant: 'team' | 'admin';
  onInputActivity?: () => void;
  /** 글이 없어도 보낼 수 있다(사진·파일만 보낼 때) */
  allowEmpty?: boolean;
  /** 주면 입력칸 왼쪽에 「+」가 생기고, 붙여넣기·끌어다 놓기로도 파일을 받는다 */
  onAttachFiles?: (files: File[]) => void;
};

export function StaffChatComposer({
  value,
  onChange,
  onSubmit,
  sending = false,
  disabled = false,
  placeholder,
  sendLabel,
  error,
  variant,
  onInputActivity,
  allowEmpty = false,
  onAttachFiles,
}: StaffChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) resizeStaffChatComposer(textareaRef.current);
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldStaffChatEnterSend(e)) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  const busy = sending || disabled;
  const canSend = !busy && (Boolean(value.trim()) || allowEmpty);

  const textarea = (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        onInputActivity?.();
      }}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        if (!onAttachFiles) return;
        const files = Array.from(e.clipboardData?.files ?? []);
        if (files.length === 0) return;
        e.preventDefault();
        onAttachFiles(files);
      }}
      placeholder={placeholder}
      className={
        variant === 'admin'
          ? 'kakaotalk-composer-input'
          : 'min-h-[42px] max-h-[120px] min-w-0 flex-1 resize-none overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-300 px-3 py-2 text-fluid-xs leading-snug text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
      }
      disabled={busy}
      autoComplete="off"
      enterKeyHint="enter"
    />
  );

  if (variant === 'admin') {
    return (
      <form onSubmit={onSubmit} className="kakaotalk-composer">
        {error ? (
          <p className="kakaotalk-send-error" role="alert">
            {error}
          </p>
        ) : null}
        <div
          className="kakaotalk-composer-row"
          onDragOver={(e) => {
            if (onAttachFiles && e.dataTransfer?.types?.includes('Files')) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!onAttachFiles) return;
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (files.length === 0) return;
            e.preventDefault();
            onAttachFiles(files);
          }}
        >
          {onAttachFiles ? (
            <>
              <input
                ref={attachRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  if (files.length > 0) onAttachFiles(files);
                }}
              />
              <button
                type="button"
                aria-label="사진·파일 붙이기"
                title="사진·파일 붙이기"
                disabled={busy}
                onClick={() => attachRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-slate-100 text-xl leading-none text-slate-600 hover:bg-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                +
              </button>
            </>
          ) : null}
          {textarea}
          <button type="submit" disabled={!canSend} className="kakaotalk-composer-send">
            {sendLabel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="shrink-0 border-t border-gray-200 bg-white p-2 sm:p-4">
      {error ? (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        {textarea}
        <button
          type="submit"
          disabled={!canSend}
          className="min-h-[44px] shrink-0 touch-manipulation rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {sendLabel}
        </button>
      </div>
    </form>
  );
}
