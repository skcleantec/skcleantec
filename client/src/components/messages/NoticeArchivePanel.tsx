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

function whenShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${sameYear ? '' : `${String(d.getFullYear()).slice(2)}.`}${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
      className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
        filter === key ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 md:max-w-[1120px] md:rounded-xl md:border md:border-slate-200 md:bg-white md:p-3">
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
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:h-7 md:max-w-[240px] md:px-2.5 md:text-[12.5px]"
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
        {items.length > 0 ? (
          <div className="hidden grid-cols-[104px_minmax(0,1fr)_110px_170px_96px] gap-3 border-b border-slate-200 px-3 pb-1.5 text-[11.5px] font-semibold text-slate-500 md:grid">
            <span>보낸 때</span>
            <span>내용</span>
            <span>붙인 것</span>
            <span>받는 사람</span>
            <span className="text-right">읽음</span>
          </div>
        ) : null}
        <ul className="grid grid-cols-[minmax(0,1fr)] max-md:gap-2">
          {items.map((n) => {
            const { images, files } = splitAttachments(n.attachments);
            const open = openId === n.batchId;
            const title = n.content?.trim() || attachmentSummary(images.length, files.length);
            const attach = attachmentSummary(images.length, files.length);
            const allRead = n.read ? n.read.readCount >= n.read.totalCount : false;
            return (
              <li
                key={n.batchId}
                className={`min-w-0 bg-white max-md:rounded-xl max-md:border max-md:border-slate-200 md:border-b md:border-slate-100 ${
                  open ? 'md:bg-violet-50/40' : 'md:hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : n.batchId)}
                  aria-expanded={open}
                  className="w-full text-left"
                >
                  {/* PC: 한 줄 */}
                  <span className="hidden h-9 grid-cols-[104px_minmax(0,1fr)_110px_170px_96px] items-center gap-3 px-3 text-[12.5px] md:grid">
                    <span className="tabular-nums text-slate-500">{whenShort(n.createdAt)}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {images.slice(0, 3).map((img) => (
                        <img key={img.id} src={imageThumb(img)} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                      ))}
                      <span className="truncate font-semibold text-slate-900">{title}</span>
                    </span>
                    <span className="truncate text-slate-600">{attach || '—'}</span>
                    <span className="truncate text-slate-600">
                      {n.senderName}
                      {targetsText(n.targets) ? ` → ${targetsText(n.targets)}` : ''}
                    </span>
                    <span className={`text-right font-bold tabular-nums ${allRead ? 'text-slate-400' : 'text-violet-700'}`}>
                      {!pickMode && n.read ? `${n.read.readCount}/${n.read.totalCount}` : ''}
                    </span>
                  </span>
                  {/* 모바일: 두 줄 카드 */}
                  <span className="flex items-center gap-2.5 px-3 py-2.5 md:hidden">
                    {images.length > 0 ? (
                      <img src={imageThumb(images[0])} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : files.length > 0 ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-[10px] font-black text-red-700">
                        PDF
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-slate-900">{title}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                        {whenShort(n.createdAt)} · {n.senderName}
                        {attach ? ` · ${attach}` : ''}
                      </span>
                    </span>
                    {!pickMode && n.read ? (
                      <span className={`shrink-0 text-[13px] font-extrabold tabular-nums ${allRead ? 'text-slate-400' : 'text-violet-700'}`}>
                        {n.read.readCount}/{n.read.totalCount}
                      </span>
                    ) : null}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-slate-100 px-3 pb-3 pt-2 md:pl-[128px]">
                    {n.content?.trim() ? (
                      <p className="max-w-[720px] whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-800">{n.content}</p>
                    ) : null}
                    {images.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {images.map((img, i) => (
                          <button
                            key={img.id}
                            type="button"
                            aria-label={`사진 ${i + 1} 크게 보기`}
                            onClick={() => setViewer({ images, index: i, caption: `${n.senderName} · ${when(n.createdAt)}` })}
                            className="h-16 w-16 overflow-hidden rounded-lg bg-slate-200"
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
                        className="mt-1.5 flex max-w-[420px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] no-underline hover:bg-slate-50"
                      >
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">PDF</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{f.fileName}</span>
                        <span className="shrink-0 text-[11.5px] text-slate-500">{formatFileSize(f.sizeBytes)}</span>
                      </a>
                    ))}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!pickMode && n.crew && n.crew.totalCount > 0 ? (
                        <span className="mr-1 text-[12px] tabular-nums text-slate-500">
                          팀원 그룹 {n.crew.readCount}/{n.crew.totalCount}
                        </span>
                      ) : null}
                      {!pickMode ? (
                        <button
                          type="button"
                          onClick={() => setReaders(n)}
                          className="inline-flex h-7 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          누가 읽었나 보기
                        </button>
                      ) : null}
                      {onReuse && n.attachments.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => onReuse(n.attachments)}
                          className="inline-flex h-7 items-center rounded-lg bg-violet-700 px-2.5 text-[12px] font-semibold text-white hover:bg-violet-800"
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
