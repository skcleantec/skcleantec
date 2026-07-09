import { Fragment, useState, type DragEvent, type ReactNode } from 'react';
import { updateTelecrmSoomgoMessagePreset } from '../../../api/telecrmSoomgoMessagePresets';

/** slotIndex 0 = 맨 앞, length = 맨 뒤 (박스 사이 삽입) */
export function reorderPresetToSlot<T extends { id: string }>(
  items: T[],
  dragId: string,
  slotIndex: number,
): T[] {
  const from = items.findIndex((item) => item.id === dragId);
  if (from < 0) return items;
  const slot = Math.max(0, Math.min(slotIndex, items.length));
  const next = items.filter((item) => item.id !== dragId);
  let insertAt = slot;
  if (from < slot) insertAt = slot - 1;
  insertAt = Math.max(0, Math.min(insertAt, next.length));
  next.splice(insertAt, 0, items[from]!);
  return next;
}

export function applyPresetSortOrder<T extends { id: string; sortOrder?: number }>(
  items: T[],
  ordered: { id: string }[],
): T[] {
  const orderMap = new Map(ordered.map((p, i) => [p.id, i]));
  return [...items]
    .map((p) => {
      const idx = orderMap.get(p.id);
      return idx !== undefined ? { ...p, sortOrder: idx } : p;
    })
    .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
}

export async function persistPresetSortOrder(token: string, ordered: { id: string }[]): Promise<void> {
  const results = await Promise.all(
    ordered.map((preset, index) =>
      updateTelecrmSoomgoMessagePreset(token, preset.id, { sortOrder: index }),
    ),
  );
  const mismatches = ordered.filter((_, i) => results[i]?.sortOrder !== i);
  if (mismatches.length > 0) {
    throw new Error('일부 프리셋 순서 저장에 실패했습니다. 다시 시도해 주세요.');
  }
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
        e.stopPropagation();
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

function PresetDropSlot({
  slotIndex,
  active,
  dragging,
  disabled,
  onHover,
  onDrop,
}: {
  slotIndex: number;
  active: boolean;
  dragging: boolean;
  disabled?: boolean;
  onHover: (slotIndex: number) => void;
  onDrop: (e: DragEvent, slotIndex: number) => void;
}) {
  if (!dragging) {
    return <div className="h-0.5" aria-hidden />;
  }

  return (
    <div
      className={[
        'relative flex items-center justify-center transition-all duration-150',
        active ? 'my-1 h-7' : 'my-0.5 h-3',
        disabled ? 'pointer-events-none opacity-40' : '',
      ].join(' ')}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        onHover(slotIndex);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHover(slotIndex);
      }}
      onDrop={(e) => onDrop(e, slotIndex)}
    >
      <div
        className={[
          'w-full rounded-full transition-all',
          active ? 'h-1.5 border-2 border-sky-500 bg-sky-200 shadow-sm' : 'h-0.5 bg-slate-200/80',
        ].join(' ')}
      />
      {active ? (
        <span className="pointer-events-none absolute text-[9px] font-semibold text-sky-700">여기에 놓기</span>
      ) : null}
    </div>
  );
}

export function PresetDragReorderList<T extends { id: string }>({
  items,
  disabled,
  onReorder,
  renderItem,
  className = '',
}: {
  items: T[];
  disabled?: boolean;
  onReorder: (dragId: string, slotIndex: number) => void;
  renderItem: (
    item: T,
    index: number,
    ctx: {
      draggingId: string | null;
      isDragging: boolean;
      dragHandleProps: { onDragStart: () => void; onDragEnd: () => void };
    },
  ) => ReactNode;
  className?: string;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const dragging = draggingId != null;

  const handleDrop = (e: DragEvent, slotIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setHoverSlot(null);
    if (!dragId || disabled) return;
    onReorder(dragId, slotIndex);
  };

  const endDrag = () => {
    setDraggingId(null);
    setHoverSlot(null);
  };

  if (items.length === 0) return null;

  return (
    <div className={className} onDragLeave={(e) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setHoverSlot(null);
    }}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <PresetDropSlot
            slotIndex={index}
            active={hoverSlot === index}
            dragging={dragging}
            disabled={disabled}
            onHover={setHoverSlot}
            onDrop={handleDrop}
          />
          <div className={draggingId === item.id ? 'opacity-45' : ''}>
            {renderItem(item, index, {
              draggingId,
              isDragging: dragging,
              dragHandleProps: {
                onDragStart: () => setDraggingId(item.id),
                onDragEnd: endDrag,
              },
            })}
          </div>
        </Fragment>
      ))}
      <PresetDropSlot
        slotIndex={items.length}
        active={hoverSlot === items.length}
        dragging={dragging}
        disabled={disabled}
        onHover={setHoverSlot}
        onDrop={handleDrop}
      />
      {dragging ? (
        <p className="mt-1 text-center text-[9px] text-sky-700">항목 사이 파란 줄에 놓으면 순서가 바뀝니다</p>
      ) : null}
    </div>
  );
}

/** @deprecated PresetDragReorderList 사용 */
export function reorderPresetRows<T extends { id: string }>(items: T[], dragId: string, targetId: string): T[] {
  const to = items.findIndex((item) => item.id === targetId);
  return reorderPresetToSlot(items, dragId, to < 0 ? 0 : to);
}
