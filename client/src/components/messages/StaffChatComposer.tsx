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
}: StaffChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) resizeStaffChatComposer(textareaRef.current);
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldStaffChatEnterSend(e)) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  const busy = sending || disabled;
  const canSend = !busy && Boolean(value.trim());

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
        <div className="kakaotalk-composer-row">
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
