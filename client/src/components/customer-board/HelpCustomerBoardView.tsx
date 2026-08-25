import { useCallback, useEffect, useMemo, useState } from 'react';
import { KakaoChannelChatLink } from '../common/KakaoChannelChatLink';
import { HelpCmsArticleBody } from '../help-cms/HelpCmsArticleBody';
import { HelpCmsRichEditor } from '../help-cms/HelpCmsRichEditor';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import { getMe } from '../../api/auth';
import { getToken } from '../../stores/auth';
import {
  createPublicCustomerInquiryPost,
  fetchPublicCustomerBoardPost,
  fetchPublicCustomerBoardPosts,
  fetchPublicCustomerBoardSettings,
  uploadPublicCustomerBoardImage,
  type PlatformBoardPost,
  type PublicCustomerBoardSettings,
} from '../../api/publicCustomerBoard';

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

  const [categoryId, setCategoryId] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [isSecret, setIsSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicCustomerBoardSettings(boardSlug)
      .then((s) => {
        setSettings(s);
        if (s.categories[0]) setCategoryId(s.categories[0].id);
      })
      .catch((e) => setSettingsError(e instanceof Error ? e.message : '설정 로드 실패'));
  }, [boardSlug]);

  useEffect(() => {
    if (!isInquiry || view !== 'compose') return;
    const token = getToken();
    if (!token) return;
    getMe(token)
      .then((me) => {
        if (me.name) setAuthorName(me.name);
        if (me.email) setAuthorEmail(me.email);
      })
      .catch(() => {});
  }, [isInquiry, view]);

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

  const handleSubmitInquiry = async () => {
    if (!settings) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const r = await createPublicCustomerInquiryPost(boardSlug, {
        categoryId,
        authorName,
        authorEmail,
        title,
        bodyHtml,
        isSecret,
      });
      setSubmitMsg(r.emailSent ? '문의가 등록되었습니다.' : '문의가 등록되었습니다. (알림 메일 미발송)');
      openDetail(r.post.id);
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="mx-auto max-w-3xl">
      {isInquiry ? <KakaoChannelChatLink variant="banner" /> : null}
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
                  setView('compose');
                  setSubmitMsg(null);
                  setTitle('');
                  setBodyHtml('<p></p>');
                  setIsSecret(false);
                }}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                문의하기
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
                      className="group flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 sm:px-4"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-fluid-2xs font-bold text-white">
                        {isInquiry ? '?' : 'N'}
                      </span>
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
            </article>
          )}
        </div>
      ) : null}

      {view === 'compose' && isInquiry ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-fluid-sm font-bold text-slate-900">문의하기</h2>
            <button
              type="button"
              onClick={goList}
              className="text-fluid-xs text-slate-600 hover:text-slate-900"
            >
              취소
            </button>
          </div>
          {settings?.composeHelpText ? (
            <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-fluid-2xs text-sky-900">
              {settings.composeHelpText}
            </p>
          ) : null}
          <label className="block space-y-1">
            <span className="text-fluid-2xs font-medium text-slate-600">카테고리</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {settings?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-fluid-2xs font-medium text-slate-600">이름</span>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-fluid-2xs font-medium text-slate-600">이메일</span>
              <input
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-fluid-2xs font-medium text-slate-600">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="flex items-center gap-2 text-fluid-xs text-slate-700">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
              className="rounded border-slate-300"
            />
            비밀글 (본문은 작성자 이메일로만 열람)
          </label>
          <div>
            <p className="mb-1 text-fluid-2xs font-medium text-slate-600">내용</p>
            <HelpCmsRichEditor
              editorKey="help-inquiry-compose"
              value={bodyHtml}
              onChange={setBodyHtml}
              onUploadImage={(file) => uploadPublicCustomerBoardImage(boardSlug, file)}
              placeholder="문의 내용을 입력하세요. 사진·링크를 넣을 수 있습니다."
            />
          </div>
          {submitMsg ? (
            <p className={`text-fluid-xs ${submitMsg.includes('실패') ? 'text-red-600' : 'text-emerald-700'}`}>
              {submitMsg}
            </p>
          ) : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmitInquiry()}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none sm:w-auto sm:px-8"
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
