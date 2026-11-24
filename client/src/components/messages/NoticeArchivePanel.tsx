import { useCallback, useEffect, useState } from 'react';
import { listNotices, type MessageAttachment, type NoticeArchiveItem } from '../../api/messages';
import { attachmentSummary, formatFileSize, imageThumb, splitAttachments } from './messageAttachments';
import { MessagePhotoViewer } from './MessagePhotoViewer';
import { NoticeReadersDialog } from './NoticeDialogs';

type Props = {
  token: string;
  /** 「이 사진·파일 다시 붙이기」를 눌렀을 때 */
  onReuse?: (attachments: MessageAttachment[]) => void;
  /** 다시 붙이기 고르는 창으로 쓸 때: 읽음 현황을 숨긴다 */
  pickMode?: boolean;
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function targetsText(t: NoticeArchiveItem['targets']): string {
  if (!t) return '';
  const parts: string[] = [];
  if (t.teamLeaders) parts.push(`팀장 ${t.teamLeaders}`);
  if (t.externalPartners) parts.push(`외부업체 ${t.externalPartners}`);
  if (t.marketers) parts.push(`마케터 ${t.marketers}`);
  if (t.crewGroups) parts.push(`팀원 그룹 ${t.crewGroups}`);
  return parts.join(' · ');
}

/** 관리자·마케터: 보낸 공지 모아보기 */
export function NoticeArchivePanel({ token, onReuse, pickMode }: Props) {
  const [filter, setFilter] = useState<'all' | 'image' | 'file'>('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<NoticeArchiveItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ images: MessageAttachment[]; index: number; caption: string } | null>(null);
  const [readers, setReaders] = useState<NoticeArchiveItem | null>(null);

  const load = useCallback(
    (more?: string | null) => {
      setLoading(true);
      setError(null);
      listNotices(token, { filter, q, cursor: more ?? null })
        .then((r) => {
          setItems((prev) => (more ? [...prev, ...r.items] : r.items));
          setCursor(r.nextCursor);
        })
        .catch((e) => {
          if (!more) setItems([]);
          setError(e instanceof Error ? e.message : '공지 목록을 불러오지 못했습니다.');
        })
        .finally(() => setLoading(false));
    },
    [token, filter, q],
  );

  useEffect(() => {
    const t = setTimeout(() => load(null), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const chip = (key: typeof filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${
        filter === key ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {chip('all', '전체')}
          {chip('image', '사진')}
          {chip('file', '파일')}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="공지 찾기"
          aria-label="공지 찾기"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:max-w-[260px]"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loading && items.length === 0 && !error ? (
          <p className="py-10 text-center text-[14px] text-slate-500">
            {q || filter !== 'all' ? '조건에 맞는 공지가 없습니다.' : '아직 보낸 공지가 없습니다.'}
          </p>
        ) : null}
        <ul className="grid gap-2.5">
          {items.map((n) => {
            const { images, files } = splitAttachments(n.attachments);
            const open = openId === n.batchId;
            return (
              <li key={n.batchId} className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : n.batchId)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left md:px-4"
                >
                  {images.length > 0 ? (
                    <span className="flex shrink-0 gap-0.5">
                      {images.slice(0, 3).map((img, i) => (
                        <img
                          key={img.id}
                          src={imageThumb(img)}
                          alt=""
                          className={`h-12 w-12 rounded-md object-cover ${i > 0 ? 'max-md:hidden' : ''}`}
                        />
                      ))}
                    </span>
                  ) : files.length > 0 ? (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-red-100 text-[11px] font-black text-red-700">
                      PDF
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-slate-900">
                      {n.content?.trim() || attachmentSummary(images.length, files.length)}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">
                      {when(n.createdAt)} · {n.senderName}
                      {targetsText(n.targets) ? ` · ${targetsText(n.targets)}` : ''}
                    </span>
                    {images.length + files.length > 0 ? (
                      <span className="mt-1 block text-[12px] font-semibold text-slate-600">
                        {attachmentSummary(images.length, files.length)}
                      </span>
                    ) : null}
                  </span>
                  {!pickMode && n.read ? (
                    <span className="shrink-0 text-right">
                      <span className="block text-[13.5px] font-extrabold tabular-nums text-violet-700">
                        읽음 {n.read.readCount}/{n.read.totalCount}
                      </span>
                      {n.crew && n.crew.totalCount > 0 ? (
                        <span className="block text-[12px] tabular-nums text-slate-500">
                          팀원 그룹 {n.crew.readCount}/{n.crew.totalCount}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
                {open ? (
                  <div className="border-t border-slate-100 px-3 pb-3 pt-3 md:px-4">
                    {n.content?.trim() ? (
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-800">{n.content}</p>
                    ) : null}
                    {images.length > 0 ? (
                      <div className="mt-2 grid grid-cols-4 gap-1 md:grid-cols-8">
                        {images.map((img, i) => (
                          <button
                            key={img.id}
                            type="button"
                            aria-label={`사진 ${i + 1} 크게 보기`}
                            onClick={() => setViewer({ images, index: i, caption: `${n.senderName} · ${when(n.createdAt)}` })}
                            className="aspect-square overflow-hidden rounded-md bg-slate-200"
                          >
                            <img src={imageThumb(img)} alt={img.fileName} className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {files.map((f) => (
                      <a
                        key={f.id}
                        href={f.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] no-underline hover:bg-slate-50"
                      >
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">PDF</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{f.fileName}</span>
                        <span className="shrink-0 text-[12px] text-slate-500">{formatFileSize(f.sizeBytes)}</span>
                      </a>
                    ))}
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {!pickMode ? (
                        <button
                          type="button"
                          onClick={() => setReaders(n)}
                          className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-bold text-slate-700 hover:bg-slate-50"
                        >
                          누가 읽었나 보기
                        </button>
                      ) : null}
                      {onReuse && n.attachments.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => onReuse(n.attachments)}
                          className="inline-flex h-8 items-center rounded-lg bg-violet-700 px-3 text-[12.5px] font-bold text-white hover:bg-violet-800"
                        >
                          이 사진·파일 다시 붙이기
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {loading ? <p className="py-4 text-center text-[13px] text-slate-500">불러오는 중…</p> : null}
        {!loading && cursor ? (
          <div className="py-3 text-center">
            <button
              type="button"
              onClick={() => load(cursor)}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
            >
              더 보기
            </button>
          </div>
        ) : null}
      </div>

      {viewer ? (
        <MessagePhotoViewer
          images={viewer.images}
          startIndex={viewer.index}
          caption={viewer.caption}
          onClose={() => setViewer(null)}
        />
      ) : null}
      {readers ? (
        <NoticeReadersDialog
          token={token}
          batchId={readers.batchId}
          title={readers.content?.trim() || undefined}
          onClose={() => setReaders(null)}
        />
      ) : null}
    </div>
  );
}
