import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HelpCmsArticleBody } from '../help-cms/HelpCmsArticleBody';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import { usePublicSeoMeta } from '../../hooks/usePublicSeoMeta';
import {
  fetchPublicCustomerBoardPost,
  fetchPublicCustomerBoardPosts,
  fetchPublicCustomerBoardSettings,
  type PlatformBoardPost,
  type PublicCustomerBoardSettings,
} from '../../api/publicCustomerBoard';
import { toast } from '../ui/Toast';
import { HelpInquiryComposeForm } from './HelpInquiryComposeForm';
import { HelpInquiryReplies } from './HelpInquiryReplies';

type View = 'list' | 'detail' | 'compose';

type Props = {
  boardSlug: 'notice' | 'inquiry';
  postIdFromUrl?: string | null;
  onPostIdChange?: (id: string | null) => void;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function HelpCustomerBoardView({ boardSlug, postIdFromUrl, onPostIdChange }: Props) {
  const isInquiry = boardSlug === 'inquiry';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<PublicCustomerBoardSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [view, setView] = useState<View>(postIdFromUrl ? 'detail' : 'list');
  const [items, setItems] = useState<PlatformBoardPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listLoading, setListLoading] = useState(true);
  const [categorySlug, setCategorySlug] = useState<string>('');
  const [searchQ, setSearchQ] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [detail, setDetail] = useState<PlatformBoardPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessEmailInput, setAccessEmailInput] = useState('');
  const [needSecretUnlock, setNeedSecretUnlock] = useState(false);

  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicCustomerBoardSettings(boardSlug)
      .then((s) => setSettings(s))
      .catch((e) => setSettingsError(e instanceof Error ? e.message : '설정 로드 실패'));
  }, [boardSlug]);

  useEffect(() => {
    if (!isInquiry) return;
    if (searchParams.get('compose') !== '1') return;
    setComposeTitle(searchParams.get('title') ?? '');
    setComposeBody(searchParams.get('hint') ?? '');
    setView('compose');
    // 한 번 열었으면 주소에서 지운다 — 목록으로 돌아갈 때 다시 열리지 않게
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('compose');
        next.delete('title');
        next.delete('hint');
        return next;
      },
      { replace: true },
    );
  }, [isInquiry, searchParams, setSearchParams]);

  const loadList = useCallback(() => {
    setListLoading(true);
    fetchPublicCustomerBoardPosts({
      boardSlug,
      categorySlug: categorySlug || undefined,
      q: searchQ || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setListLoading(false));
  }, [boardSlug, categorySlug, searchQ, page, pageSize]);

  useEffect(() => {
    if (view === 'list') loadList();
  }, [view, loadList]);

  const openDetail = useCallback(
    (id: string, email?: string) => {
      setView('detail');
      onPostIdChange?.(id);
      setDetailLoading(true);
      setDetail(null);
      setNeedSecretUnlock(false);
      fetchPublicCustomerBoardPost({ boardSlug, postId: id, accessEmail: email })
        .then((post) => {
          setDetail(post);
          if (post.isSecret && !post.bodyHtml) setNeedSecretUnlock(true);
        })
        .catch(() => setDetail(null))
        .finally(() => setDetailLoading(false));
    },
    [boardSlug, onPostIdChange],
  );

  useEffect(() => {
    if (postIdFromUrl) openDetail(postIdFromUrl, accessEmail || undefined);
  }, [postIdFromUrl, openDetail, accessEmail]);

  const noticeTitle = !isInquiry && detail?.title ? `${detail.title} | 청소비서` : '';
  const noticeDesc =
    !isInquiry && detail
      ? (detail.excerpt?.trim() || detail.title || '청소비서 공지')
      : '';
  usePublicSeoMeta({
    title: noticeTitle || (isInquiry ? '고객문의 | 청소비서' : '공지사항 | 청소비서'),
    description: noticeDesc || (isInquiry ? '청소비서 고객문의' : '청소비서 서비스 공지와 업데이트 안내.'),
    robots: isInquiry ? 'noindex,nofollow' : 'index,follow',
  });

  const goList = () => {
    setView('list');
    onPostIdChange?.(null);
    setDetail(null);
    setNeedSecretUnlock(false);
  };

  const tryUnlockSecret = () => {
    if (!detail) return;
    openDetail(detail.id, accessEmailInput.trim());
    setAccessEmail(accessEmailInput.trim());
  };

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 3000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const categoryLabel = useMemo(() => {
    if (!settings) return '';
    const hit = settings.categories.find((c) => c.slug === categorySlug);
    return hit?.label ?? '전체';
  }, [settings, categorySlug]);

  if (settingsError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-fluid-sm text-red-700">
        {settingsError}
      </div>
    );
  }

  return (
    <div className={view === 'compose' ? 'mx-auto max-w-[1120px]' : 'mx-auto max-w-3xl'}>
      {/* 필터 · 검색 — 레퍼런스 HELP 스타일 */}
      {view === 'list' ? (
        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCategorySlug('');
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-fluid-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                !categorySlug
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              전체
            </button>
            {settings?.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategorySlug(c.slug);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1 text-fluid-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                  categorySlug === c.slug
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchQ(searchInput.trim());
              setPage(1);
            }}
          >
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목 검색"
              className="min-h-9 flex-1 rounded-lg border border-slate-200 px-3 text-fluid-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              검색
            </button>
          </form>
          {searchQ ? (
            <p className="text-fluid-2xs text-slate-500">
              「{searchQ}」 검색 · {categoryLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {view === 'list' ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-fluid-sm font-bold text-slate-900">{settings?.label ?? boardSlug}</h2>
            {isInquiry ? (
              <button
                type="button"
                onClick={() => {
                  setComposeTitle('');
                  setComposeBody('');
                  setView('compose');
                  window.scrollTo({ top: 0 });
                }}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                1:1 문의 남기기
              </button>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {listLoading ? (
              <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-fluid-sm text-slate-500">등록된 글이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(row.id)}
                      className={`group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 sm:px-4 ${
                        row.id === highlightId ? 'bg-[#F0FDF4]' : ''
                      }`}
                    >
                      {!isInquiry && row.thumbnailUrl ? (
                        <img
                          src={row.thumbnailUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-fluid-2xs font-bold text-white sm:h-16 sm:w-16">
                          {isInquiry ? '?' : 'N'}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate text-fluid-sm font-medium text-slate-900 group-hover:text-slate-700">
                            {row.title}
                          </span>
                          {row.isSecret ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0 text-fluid-2xs font-medium text-amber-800">
                              비밀
                            </span>
                          ) : null}
                          {row.isPinned ? (
                            <span className="rounded bg-sky-50 px-1.5 py-0 text-fluid-2xs font-medium text-sky-800">
                              고정
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-2 text-fluid-2xs text-slate-500">
                          {row.categoryLabel ? <span>{row.categoryLabel}</span> : null}
                          {isInquiry && row.authorName ? <span>{row.authorName}</span> : null}
                          <span>{formatWhen(row.createdAt)}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-slate-300" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!listLoading ? (
            <div className="mt-3">
              <ListPaginationBar
                mode="nav"
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </div>
          ) : null}

          {isInquiry && settings?.composeHelpText ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-2xs leading-snug text-slate-600">
              {settings.composeHelpText}
            </p>
          ) : null}
        </>
      ) : null}

      {view === 'detail' ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-4">
            <button
              type="button"
              onClick={goList}
              className="text-fluid-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
            >
              ← 목록
            </button>
            {detail?.categoryLabel ? (
              <span className="text-fluid-2xs text-slate-500">{detail.categoryLabel}</span>
            ) : null}
          </div>
          {detailLoading ? (
            <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
          ) : !detail ? (
            <p className="p-8 text-center text-fluid-sm text-slate-500">글을 찾을 수 없습니다.</p>
          ) : needSecretUnlock && !detail.bodyHtml ? (
            <div className="space-y-3 p-4 sm:p-6">
              <h3 className="text-fluid-sm font-bold text-slate-900">{detail.title}</h3>
              <p className="text-fluid-xs text-slate-600">비밀글입니다. 작성 시 입력한 이메일로 확인해 주세요.</p>
              <input
                type="email"
                value={accessEmailInput}
                onChange={(e) => setAccessEmailInput(e.target.value)}
                placeholder="작성자 이메일"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={tryUnlockSecret}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                확인
              </button>
            </div>
          ) : (
            <article className="p-4 sm:p-6">
              <h1 className="mb-2 text-fluid-base font-bold text-slate-900 sm:text-fluid-lg">{detail.title}</h1>
              <p className="mb-4 text-fluid-2xs text-slate-500">{formatWhen(detail.createdAt)}</p>
              {detail.bodyHtml ? <HelpCmsArticleBody html={detail.bodyHtml} /> : null}
              {isInquiry && detail.bodyHtml ? <HelpInquiryReplies replies={detail.replies ?? []} /> : null}
            </article>
          )}
        </div>
      ) : null}

      {view === 'compose' && isInquiry && settings ? (
        <HelpInquiryComposeForm
          boardSlug={boardSlug}
          settings={settings}
          initialTitle={composeTitle}
          initialBody={composeBody}
          onCancel={goList}
          onPickArticle={(path) => navigate(path)}
          onSubmitted={(post, email) => {
            toast.success(`문의를 남겼어요. 답변은 ${email} 로 보내 드려요.`);
            setHighlightId(post.id);
            setCategorySlug('');
            setSearchQ('');
            setSearchInput('');
            setPage(1);
            goList();
            window.scrollTo({ top: 0 });
          }}
        />
      ) : null}
    </div>
  );
}
