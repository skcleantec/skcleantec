import type { DragEvent } from 'react';
import { updateTelecrmSoomgoMessagePreset } from '../../../api/telecrmSoomgoMessagePresets';

export function reorderPresetRows<T extends { id: string }>(items: T[], dragId: string, targetId: string): T[] {
  const from = items.findIndex((item) => item.id === dragId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export async function persistPresetSortOrder(token: string, ordered: { id: string }[]): Promise<void> {
  await Promise.all(
    ordered.map((preset, index) => updateTelecrmSoomgoMessagePreset(token, preset.id, { sortOrder: index })),
  );
}

export function SoomgoPresetDragHandle({
  presetId,
  label,
  disabled,
  onDragStart,
  onDragEnd,
}: {
  presetId: string;
  label: string;
  disabled?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  return (
    <span
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) return;
        e.dataTransfer.setData('text/plain', presetId);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      title={`${label} — 드래그하여 순서 변경`}
      aria-label={`${label} 순서 변경`}
      className={[
        'inline-flex shrink-0 cursor-grab select-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1 py-1 text-slate-400 active:cursor-grabbing',
        disabled ? 'pointer-events-none opacity-40' : 'hover:border-slate-300 hover:bg-white hover:text-slate-600',
      ].join(' ')}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden className="text-current">
        <circle cx="2.5" cy="2.5" r="1.2" fill="currentColor" />
        <circle cx="7.5" cy="2.5" r="1.2" fill="currentColor" />
        <circle cx="2.5" cy="7" r="1.2" fill="currentColor" />
        <circle cx="7.5" cy="7" r="1.2" fill="currentColor" />
        <circle cx="2.5" cy="11.5" r="1.2" fill="currentColor" />
        <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}

export function usePresetDropTarget(
  onDrop: (dragId: string, targetId: string) => void,
  draggingId: string | null,
  setDraggingId: (id: string | null) => void,
) {
  return {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDragEnter: (e: DragEvent, targetId: string) => {
      e.preventDefault();
      if (draggingId && draggingId !== targetId) setDraggingId(targetId);
    },
    onDrop: (e: DragEvent, targetId: string) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('text/plain');
      setDraggingId(null);
      if (!dragId || dragId === targetId) return;
      onDrop(dragId, targetId);
    },
    onDragEnd: () => setDraggingId(null),
  };
}
