import { useRef, useState } from 'react';
import type { AttachmentDraft } from './useAttachmentDraft';
import { attachmentSummary } from './messageAttachments';

type Props = {
  draft: AttachmentDraft;
  disabled?: boolean;
  /** 작은 입력칸(1:1)용 */
  compact?: boolean;
  /** 「지난 공지」에서 다시 붙이기 */
  onPickFromArchive?: () => void;
};

/** 붙여 둔 사진·파일 줄 + 붙이기 단추. 번호가 보내지는 순서. */
export function AttachmentDraftStrip({ draft, disabled, compact, onPickFromArchive }: Props) {
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { items } = draft;
  const size = compact ? 56 : 72;

  const pickBtn =
    'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[12.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';

  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    draft.addFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={take} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={take} />
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={take} />

      {items.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="붙인 사진과 파일">
          {items.map((it, i) => (
            <div
              key={it.key}
              role="listitem"
              draggable={!disabled}
              onDragStart={() => setDragKey(it.key)}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => {
                if (dragKey) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!dragKey) return;
                e.preventDefault();
                e.stopPropagation();
                const from = items.findIndex((x) => x.key === dragKey);
                draft.move(from, i);
                setDragKey(null);
              }}
              onClick={() => setPicked((p) => (p === it.key ? null : it.key))}
              className={`relative shrink-0 cursor-grab overflow-hidden rounded-lg border bg-white ${
                it.status === 'error'
                  ? 'border-red-400 ring-2 ring-red-200'
                  : picked === it.key
                    ? 'border-violet-500 ring-2 ring-violet-200'
                    : 'border-slate-200'
              } ${dragKey === it.key ? 'opacity-40' : ''}`}
              style={{ width: size, height: size }}
              title={it.error ?? it.name}
            >
              {it.kind === 'image' && it.thumb ? (
                <img src={it.thumb} alt={it.name} className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center">
                  <span className="rounded bg-red-100 px-1 text-[9px] font-black text-red-700">PDF</span>
                  <span className="line-clamp-2 break-all text-[9.5px] leading-tight text-slate-600">{it.name}</span>
                </div>
              )}
              <span className="absolute left-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-violet-700 px-1 text-[10.5px] font-extrabold text-white">
                {i + 1}
              </span>
              <button
                type="button"
                aria-label={`${it.name} 빼기`}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  draft.remove(it.key);
                }}
                className="absolute right-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-900/70 text-[11px] leading-none text-white"
              >
                ×
              </button>
              {it.status === 'uploading' ? (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] font-bold text-violet-700">
                  올리는 중
                </span>
              ) : null}
              {it.status === 'error' ? (
                <span className="absolute inset-x-0 bottom-0 bg-red-600 py-0.5 text-center text-[10px] font-bold text-white">
                  실패
                </span>
              ) : null}
              {picked === it.key && !disabled && items.length > 1 ? (
                <span className="absolute inset-x-0 bottom-0 flex justify-between bg-slate-900/70 text-white">
                  <button
                    type="button"
                    aria-label="앞으로 옮기기"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      draft.move(i, i - 1);
                    }}
                    className="h-6 flex-1 text-[13px] disabled:opacity-30"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    aria-label="뒤로 옮기기"
                    disabled={i === items.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      draft.move(i, i + 1);
                    }}
                    className="h-6 flex-1 text-[13px] disabled:opacity-30"
                  >
                    ▶
                  </button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={pickBtn} disabled={disabled} onClick={() => photoRef.current?.click()}>
          사진
        </button>
        <button
          type="button"
          className={`${pickBtn} md:hidden`}
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          바로 찍기
        </button>
        <button type="button" className={pickBtn} disabled={disabled} onClick={() => fileRef.current?.click()}>
          PDF
        </button>
        {onPickFromArchive ? (
          <button type="button" className={pickBtn} disabled={disabled} onClick={onPickFromArchive}>
            지난 공지에서
          </button>
        ) : null}
        <span className="text-[12px] text-slate-500">
          {items.length > 0
            ? `${attachmentSummary(draft.imageCount, draft.fileCount)} · 원본으로 보냄`
            : compact
              ? ''
              : '끌어다 놓거나 붙여넣어도 됩니다'}
        </span>
      </div>
      {items.length > 1 && !compact ? (
        <p className="text-[12px] text-slate-500">
          번호가 보내지는 순서입니다. <span className="max-md:hidden">끌어서 바꾸거나, </span>사진을 누르면 ◀ ▶ 로 옮길 수 있어요.
        </p>
      ) : null}
      {draft.notice ? (
        <p className="whitespace-pre-line text-[12.5px] font-semibold text-red-600" role="alert">
          {draft.notice}
        </p>
      ) : null}
      {items.some((i) => i.status === 'error') ? (
        <p className="text-[12.5px] font-semibold text-red-600" role="alert">
          빨간 테두리 사진을 올리지 못해 보내지 않았습니다. 빼거나 다시 보내 보세요.
        </p>
      ) : null}
    </div>
  );
}
