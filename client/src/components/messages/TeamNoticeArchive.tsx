import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listTeamNotices,
  markMessageAttachmentsViewed,
  type MessageAttachment,
  type TeamNoticeItem,
} from '../../api/messages';
import { formatFileSize, imageThumb, splitAttachments } from './messageAttachments';
import { MessagePhotoViewer } from './MessagePhotoViewer';

function day(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

/** 팀장·외부업체: 받은 공지의 사진·파일을 날짜별로 다시 찾는 화면 */
export function TeamNoticeArchive({ token, onClose }: { token: string; onClose: () => void }) {
  const [tab, setTab] = useState<'all' | 'image' | 'file'>('all');
  const [items, setItems] = useState<TeamNoticeItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ images: MessageAttachment[]; index: number; caption: string } | null>(null);

  const loadMore = useCallback(
    (more: string) => {
      setLoading(true);
      setError(null);
      listTeamNotices(token, more)
        .then((r) => {
          setItems((prev) => [...prev, ...r.items]);
          setCursor(r.nextCursor);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '공지를 불러오지 못했습니다.'))
        .finally(() => setLoading(false));
    },
    [token],
  );
  useEffect(() => {
    let alive = true;
    listTeamNotices(token, null)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setCursor(r.nextCursor);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '공지를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const viewed = (n: TeamNoticeItem) => {
    if (n.messageId) void markMessageAttachmentsViewed(token, n.messageId);
  };

  const shown = items.filter((n) => {
    const { images, files } = splitAttachments(n.attachments);
    if (tab === 'image') return images.length > 0;
    if (tab === 'file') return files.length > 0;
    return true;
  });

  const chip = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${
        tab === key ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="공지 모아보기"
      className="fixed inset-0 z-[1000] flex flex-col bg-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-2">
        <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center text-xl text-slate-700">
          ‹
        </button>
        <h2 className="text-[16px] font-extrabold text-slate-900">공지 모아보기</h2>
      </div>
      <div className="flex shrink-0 gap-1.5 px-3 py-2.5">
        {chip('all', '공지')}
        {chip('image', '사진')}
        {chip('file', '파일')}
      </div>
      <div className="mx-auto min-h-0 w-full max-w-[720px] flex-1 overflow-y-auto pb-6">
        {error ? (
          <p className="mx-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && shown.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-slate-500">아직 받은 공지가 없습니다.</p>
        ) : null}
        {shown.map((n) => {
          const { images, files } = splitAttachments(n.attachments);
          return (
            <section key={n.batchId} className="pb-3">
              <h3 className="px-3 pb-1.5 pt-3 text-[13px] font-extrabold text-slate-900">
                {day(n.createdAt)}
                <span className="font-semibold text-slate-500"> · {n.senderName}</span>
              </h3>
              {tab === 'all' && n.content?.trim() ? (
                <p className="whitespace-pre-wrap break-words px-3 pb-2 text-[14px] leading-relaxed text-slate-800">{n.content}</p>
              ) : null}
              {tab !== 'file' && images.length > 0 ? (
                <div className="grid grid-cols-3 gap-0.5">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      aria-label={`사진 ${i + 1} 크게 보기`}
                      onClick={() => {
                        viewed(n);
                        setViewer({ images, index: i, caption: `${n.senderName} · ${day(n.createdAt)}` });
                      }}
                      className="aspect-square overflow-hidden bg-slate-200"
                    >
                      <img src={imageThumb(img)} alt={img.fileName} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
              {tab !== 'image'
                ? files.map((f) => (
                    <a
                      key={f.id}
                      href={f.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => viewed(n)}
                      className="mx-3 mt-2 flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 no-underline"
                    >
                      <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-[11px] font-black text-red-700">
                        PDF
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold text-slate-900">{f.fileName}</span>
                        <span className="block text-[12px] text-slate-500">
                          {[f.pageCount ? `${f.pageCount}쪽` : '', formatFileSize(f.sizeBytes)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-lg border border-violet-200 px-2.5 py-1 text-[12.5px] font-bold text-violet-700">
                        열기
                      </span>
                    </a>
                  ))
                : null}
            </section>
          );
        })}
        {loading ? <p className="py-6 text-center text-[13px] text-slate-500">불러오는 중…</p> : null}
        {!loading && cursor ? (
          <div className="py-3 text-center">
            <button
              type="button"
              onClick={() => loadMore(cursor)}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-700"
            >
              더 보기
            </button>
          </div>
        ) : null}
      </div>
      {viewer ? (
        <MessagePhotoViewer images={viewer.images} startIndex={viewer.index} caption={viewer.caption} onClose={() => setViewer(null)} />
      ) : null}
    </div>,
    document.body,
  );
}
