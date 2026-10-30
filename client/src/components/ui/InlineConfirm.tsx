import { Button } from './Button';

export function InlineConfirm({
  question,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 py-2 text-sm text-[#141b26]">
      <span>{question}</span>
      <Button size="sm" variant="danger" disabled={busy} onClick={onConfirm}>
        {busy ? '처리 중' : confirmLabel}
      </Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={onCancel}>
        그만두기
      </Button>
    </div>
  );
}
