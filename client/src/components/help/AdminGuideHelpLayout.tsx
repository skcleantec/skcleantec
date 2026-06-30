import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HelpRole } from '../../types/helpContent';
import {
  fetchMarketerGuideToc,
  resolveMarketerGuideChapter,
  marketerGuideIframeSrc,
  MARKETER_GUIDE_HTML_URL,
  type MarketerGuideChapter,
} from '../../utils/marketerGuideContent';
import { TeamGuideMobileChapterSelect, TeamGuideSidebar } from './TeamGuideSidebar';

type AdminGuideHelpLayoutProps = {
  selectedRole: HelpRole;
  onRoleChange: (role: HelpRole) => void;
};

export function AdminGuideHelpLayout({ selectedRole, onRoleChange }: AdminGuideHelpLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const chapterParam = searchParams.get('chapter');
  const [chapters, setChapters] = useState<MarketerGuideChapter[]>([]);
  const activeChapter = useMemo(
    () => resolveMarketerGuideChapter(chapterParam, chapters),
    [chapterParam, chapters],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const iframeSrc = useMemo(() => marketerGuideIframeSrc(activeChapter), [activeChapter]);

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
    if (selectedRole === 'admin' && !activeChapter) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('role', 'admin');
          next.set('chapter', '01');
          return next;
        },
        { replace: true },
      );
    }
  }, [selectedRole, activeChapter, setSearchParams]);

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
    if (!iframe || !activeChapter) return;
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
  }, [iframeSrc, activeChapter]);

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
    chapters,
    activeChapter,
    onChapterClick: changeChapter,
    selectedRole,
    onRoleChange,
    navAriaLabel: '관리자·마케터 가이드 목차',
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
      <div className="hidden lg:block lg:w-52 xl:w-56 lg:shrink-0 lg:self-start">
        <TeamGuideSidebar {...sidebarProps} />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <TeamGuideMobileChapterSelect {...sidebarProps} />

        <div className="mt-2 flex items-center justify-end lg:mt-0">
          <a
            href={activeChapter ? `${MARKETER_GUIDE_HTML_URL}#slide-${activeChapter}` : MARKETER_GUIDE_HTML_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fluid-2xs font-medium text-sky-600 underline hover:text-sky-700"
          >
            새 창에서 열기
          </a>
        </div>

        <div className="mt-1 w-full min-w-0 overflow-x-hidden">
          <iframe
            ref={iframeRef}
            key={iframeSrc}
            src={iframeSrc}
            title="청소비서 관리자(마케터) 앱 사용설명서"
            className="block w-full min-h-[calc(100dvh-11rem)] border-0 bg-[#eeecea] sm:min-h-[calc(100dvh-10rem)] lg:min-h-[calc(100dvh-9rem)]"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
