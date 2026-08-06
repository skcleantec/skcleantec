import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchPlatformCustomerBoardPosts,
  fetchPlatformCustomerBoards,
  updatePlatformCustomerBoard,
  type PlatformBoard,
  type PlatformBoardPost,
  type PlatformBoardPostStatus,
} from '../../api/platformCustomerBoard';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const STATUS_LABEL: Record<PlatformBoardPostStatus, string> = {
  OPEN: '접수',
  ANSWERED: '답변완료',
  HIDDEN: '숨김',
};

export function PlatformCustomerBoardsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const boardSlug = searchParams.get('board') || 'inquiry';
  const statusFilter = (searchParams.get('status') as PlatformBoardPostStatus | null) || '';
  const q = searchParams.get('q') || '';

  const [boards, setBoards] = useState<PlatformBoard[]>([]);
  const [items, setItems] = useState<PlatformBoardPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(q);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [composeHelpText, setComposeHelpText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const activeBoard = useMemo(
    () => boards.find((b) => b.slug === boardSlug) ?? boards[0],
    [boards, boardSlug],
  );

  const loadBoards = useCallback(async () => {
    const list = await fetchPlatformCustomerBoards();
    setBoards(list);
    const cur = list.find((b) => b.slug === boardSlug) ?? list[0];
    if (cur) {
      setNotifyEmail(cur.settings.notifyEmail ?? '');
      setContactEmail(cur.settings.contactEmail ?? '');
      setComposeHelpText(cur.settings.composeHelpText ?? '');
    }
  }, [boardSlug]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetchPlatformCustomerBoardPosts({
        boardSlug,
        status: statusFilter || undefined,
        q: q || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [boardSlug, statusFilter, q, page, pageSize]);

  useEffect(() => {
    void loadBoards().catch(() => {});
  }, [loadBoards]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const setBoard = (slug: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('board', slug);
      next.delete('status');
      next.set('page', '1');
      return next;
    });
    setPage(1);
  };

  const saveSettings = async () => {
    if (!activeBoard) return;
    setSavingSettings(true);
    try {
      await updatePlatformCustomerBoard(activeBoard.slug, {
        settings: {
          notifyEmail,
          contactEmail,
          composeHelpText: composeHelpText.trim() || null,
        },
      });
      await loadBoards();
      setSettingsOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 저장 실패');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fluid-lg font-bold text-slate-900">고객센터 게시판</h1>
          <p className="mt-0.5 text-fluid-xs text-slate-500">
            /help 공지·문의를 한곳에서 관리합니다. (도움말 CMS 사용법은 별도 메뉴)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeBoard?.boardType === 'NOTICE' ? (
            <Link
              to={`/platform/customer-boards/notice/posts/new`}
              className={BTN_PRIMARY}
            >
              공지 작성
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={BTN_SECONDARY}
          >
            {activeBoard?.label ?? '게시판'} 설정
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBoard(b.slug)}
            className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              boardSlug === b.slug
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {b.label}
            <span className="ml-1 tabular-nums opacity-70">({b.postCount})</span>
          </button>
        ))}
      </div>

      {settingsOpen && activeBoard ? (
        <div className={`${CARD_SECTION} space-y-3`}>
          <h2 className="text-fluid-sm font-semibold text-slate-900">{activeBoard.label} 설정</h2>
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">알림 수신 이메일</span>
            <input
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              className={INPUT_BASE}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-fluid-2xs text-slate-600">고객센터 연락 이메일</span>
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={INPUT_BASE}
            />
          </label>
          {activeBoard.boardType === 'INQUIRY' ? (
            <label className="block space-y-1">
              <span className="text-fluid-2xs text-slate-600">작성 안내 문구</span>
              <textarea
                value={composeHelpText}
                onChange={(e) => setComposeHelpText(e.target.value)}
                rows={3}
                className={`${INPUT_BASE} resize-y`}
              />
            </label>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingSettings}
              onClick={() => void saveSettings()}
              className={BTN_PRIMARY}
            >
              {savingSettings ? '저장 중…' : '설정 저장'}
            </button>
            <Link to={`/platform/customer-boards/categories?board=${activeBoard.slug}`} className={BTN_SECONDARY}>
              카테고리 관리
            </Link>
          </div>
        </div>
      ) : null}

      <div className={`${CARD_SECTION} space-y-3`}>
        <div className="flex flex-wrap items-end gap-2">
          {activeBoard?.boardType === 'INQUIRY' ? (
            <div className="flex flex-wrap gap-1">
              {(['', 'OPEN', 'ANSWERED', 'HIDDEN'] as const).map((st) => (
                <button
                  key={st || 'all'}
                  type="button"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      if (st) next.set('status', st);
                      else next.delete('status');
                      next.set('page', '1');
                      return next;
                    });
                    setPage(1);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-fluid-2xs font-medium ${
                    statusFilter === st
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st ? STATUS_LABEL[st] : '전체'}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="ml-auto flex min-w-[200px] flex-1 gap-2 sm:max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (searchInput.trim()) next.set('q', searchInput.trim());
                else next.delete('q');
                next.set('page', '1');
                return next;
              });
              setPage(1);
            }}
          >
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목 검색"
              className={INPUT_BASE}
            />
            <button type="submit" className={BTN_SECONDARY}>
              검색
            </button>
          </form>
        </div>

        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />

        {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-fluid-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-2 py-2 text-center">카테고리</th>
                <th className="px-2 py-2 text-center">제목</th>
                {activeBoard?.boardType === 'INQUIRY' ? (
                  <>
                    <th className="px-2 py-2 text-center">작성자</th>
                    <th className="px-2 py-2 text-center">상태</th>
                  </>
                ) : (
                  <th className="px-2 py-2 text-center">게시</th>
                )}
                <th className="px-2 py-2 text-center">일시</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-500">
                    글이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/platform/customer-boards/posts/${row.id}/edit`)}
                  >
                    <td className="px-2 py-2 text-center text-slate-600">{row.categoryLabel ?? '—'}</td>
                    <td className="max-w-[240px] truncate px-2 py-2 text-center font-medium text-slate-900" title={row.title}>
                      {row.isSecret ? '🔒 ' : ''}
                      {row.isPinned ? '📌 ' : ''}
                      {row.title}
                    </td>
                    {activeBoard?.boardType === 'INQUIRY' ? (
                      <>
                        <td className="px-2 py-2 text-center text-slate-600">
                          {row.authorName ?? '—'}
                          {row.tenantName ? (
                            <span className="block text-fluid-2xs text-slate-400">{row.tenantName}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-fluid-2xs">
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-2 text-center text-slate-600">
                        {row.isPublished ? '공개' : '비공개'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums text-slate-500">
                      {formatWhen(row.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading ? (
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
        ) : null}
      </div>
    </div>
  );
}
