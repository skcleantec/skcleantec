import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HelpRole } from '../../types/helpContent';
import {
  fetchMarketerGuideToc,
  marketerGuideIframeSrc,
  MARKETER_GUIDE_HTML_URL,
  type MarketerGuideChapter,
} from '../../utils/marketerGuideContent';
import {
  defaultHelpGuideChapter,
  HELP_WORKFLOW_CHAPTER_ID,
  resolveHelpGuideChapter,
  type HelpGuideChapterItem,
} from '../../utils/helpContent';
import { useHelpWorkflowEntry } from '../../hooks/useHelpWorkflowEntry';
import { HelpScreenCard } from './HelpScreenCard';
import { TeamGuideMobileChapterSelect, TeamGuideSidebar } from './TeamGuideSidebar';
import { MarketerGuideScreenshotEditor } from './MarketerGuideScreenshotEditor';
import type { HelpCmsCategory } from '../../api/platformHelpCms';

type AdminGuideHelpLayoutProps = {
  selectedRole: HelpRole;
  onRoleChange: (role: HelpRole) => void;
  cmsCategories?: HelpCmsCategory[];
  onCmsSectionSelect?: (slug: string) => void;
};

export function AdminGuideHelpLayout({
  selectedRole,
  onRoleChange,
  cmsCategories = [],
  onCmsSectionSelect,
}: AdminGuideHelpLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const chapterParam = searchParams.get('chapter');
  const [chapters, setChapters] = useState<MarketerGuideChapter[]>([]);
  const {
    entry: workflowEntry,
    canEdit: canEditWorkflow,
    loading: workflowLoading,
    chapter: workflowChapter,
    reload: reloadWorkflow,
  } = useHelpWorkflowEntry('admin');
  const htmlChapters = useMemo<HelpGuideChapterItem[]>(
    () => chapters.map((c) => ({ id: c.id, title: c.title, desc: c.desc })),
    [chapters],
  );
  const sidebarChapters = useMemo(() => {
    const workflow: HelpGuideChapterItem = workflowChapter ?? {
      id: HELP_WORKFLOW_CHAPTER_ID,
      title: '접수부터 팀장 배정까지',
      desc: '일반 등록·처리구분·배정 표준 흐름',
    };
    return [workflow, ...htmlChapters];
  }, [workflowChapter, htmlChapters]);
  const activeChapter = useMemo(
    () => resolveHelpGuideChapter(chapterParam, htmlChapters),
    [chapterParam, htmlChapters],
  );
  const isWorkflowView = activeChapter === HELP_WORKFLOW_CHAPTER_ID;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrc = useMemo(
    () => marketerGuideIframeSrc(isWorkflowView ? null : activeChapter),
    [activeChapter, isWorkflowView],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMarketerGuideToc()
      .then((data) => {
        if (!cancelled) setChapters(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '불러오기 실패');
          setChapters([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (chapterParam && !activeChapter) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('chapter');
          return next;
        },
        { replace: true },
      );
    }
  }, [chapterParam, activeChapter, setSearchParams]);

  useEffect(() => {
    if (selectedRole === 'admin' && !activeChapter && !loading && !workflowLoading) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('role', 'admin');
          next.set('chapter', defaultHelpGuideChapter(workflowChapter));
          return next;
        },
        { replace: true },
      );
    }
  }, [selectedRole, activeChapter, loading, workflowLoading, workflowChapter, setSearchParams]);

  const changeChapter = useCallback(
    (chapterId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('role', 'admin');
        next.set('chapter', chapterId);
        next.delete('q');
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !activeChapter || isWorkflowView) return;
    const scrollToAnchor = () => {
      try {
        const doc = iframe.contentDocument;
        const target = doc?.getElementById(`slide-${activeChapter}`);
        target?.scrollIntoView({ behavior: 'auto', block: 'start' });
      } catch {
        /* hash in src handles navigation */
      }
    };
    iframe.addEventListener('load', scrollToAnchor);
    return () => iframe.removeEventListener('load', scrollToAnchor);
  }, [iframeSrc, activeChapter, isWorkflowView]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
          <p className="mt-4 text-fluid-sm text-slate-600">관리자 가이드 불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-fluid-sm font-semibold text-red-700">{error}</p>
      </div>
    );
  }

  const sidebarProps = {
    chapters: sidebarChapters,
    activeChapter,
    onChapterClick: changeChapter,
    selectedRole,
    onRoleChange,
    navAriaLabel: '관리자·마케터 가이드 목차',
    cmsCategories,
    onCmsSectionSelect,
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
      <div className="hidden lg:block lg:w-52 xl:w-56 lg:shrink-0 lg:self-start">
        <TeamGuideSidebar {...sidebarProps} />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <TeamGuideMobileChapterSelect {...sidebarProps} />

        {!isWorkflowView ? (
          <div className="mt-2 flex items-center justify-end lg:mt-0">
            <a
              href={
                activeChapter
                  ? `${MARKETER_GUIDE_HTML_URL}#slide-${activeChapter}`
                  : MARKETER_GUIDE_HTML_URL
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-fluid-2xs font-medium text-sky-600 underline hover:text-sky-700"
            >
              새 창에서 열기
            </a>
          </div>
        ) : null}

        {!isWorkflowView ? (
          <MarketerGuideScreenshotEditor activeChapter={activeChapter} iframeRef={iframeRef} />
        ) : null}

        <div className="mt-1 w-full min-w-0 overflow-x-hidden">
          {isWorkflowView ? (
            workflowLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-slate-200 bg-white">
                <p className="text-fluid-sm text-slate-600">이용 순서 불러오는 중…</p>
              </div>
            ) : workflowEntry ? (
              <HelpScreenCard
                entry={workflowEntry}
                canEdit={canEditWorkflow}
                onUpdated={reloadWorkflow}
              />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                <p className="text-fluid-sm font-semibold text-amber-900">
                  이용 순서 도움말을 찾을 수 없습니다.
                </p>
              </div>
            )
          ) : (
            <iframe
              ref={iframeRef}
              key={iframeSrc}
              src={iframeSrc}
              title="청소비서 관리자(마케터) 앱 사용설명서"
              className="block w-full min-h-[calc(100dvh-11rem)] border-0 bg-[#eeecea] sm:min-h-[calc(100dvh-10rem)] lg:min-h-[calc(100dvh-9rem)]"
              loading="lazy"
            />
          )}
        </div>
      </div>
    </div>
  );
}
