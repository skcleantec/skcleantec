import type { HelpRole } from '../../types/helpContent';
import type { TeamGuideChapter } from '../../utils/teamGuideContent';
import { HELP_ROLE_LABELS } from '../../utils/helpContent';

type TeamGuideSidebarProps = {
  chapters: TeamGuideChapter[];
  activeChapter: string | null;
  onChapterClick: (chapterId: string) => void;
  selectedRole: HelpRole;
  onRoleChange: (role: HelpRole) => void;
};

export function TeamGuideSidebar({
  chapters,
  activeChapter,
  onChapterClick,
  selectedRole,
  onRoleChange,
}: TeamGuideSidebarProps) {
  return (
    <aside className="sticky top-[7.5rem] z-20 flex max-h-[calc(100dvh-8.5rem)] min-h-0 w-full flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {(['admin', 'team'] as const).map((role) => {
            const isActive = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => onRoleChange(role)}
                className={`
                  flex-1 rounded-md px-3 py-2 text-fluid-sm font-semibold transition-all
                  ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }
                `}
              >
                {HELP_ROLE_LABELS[role]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-200 p-4 pb-3">
        <h2 className="text-lg font-bold text-slate-900">📑 목차</h2>
        <p className="mt-1 text-fluid-2xs text-slate-500">팀장 앱 사용설명서</p>
      </div>

      <nav
        aria-label="팀장 가이드 목차"
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 [-webkit-overflow-scrolling:touch]"
      >
        <ul className="space-y-1">
          {chapters.map((chapter) => {
            const active = activeChapter === chapter.id;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => onChapterClick(chapter.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="block text-fluid-xs font-bold opacity-80">{chapter.id}</span>
                  <span className="block text-fluid-sm font-medium">{chapter.title}</span>
                  <span className={`mt-0.5 block text-fluid-2xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                    {chapter.desc}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export function TeamGuideMobileChapterSelect({
  chapters,
  activeChapter,
  onChapterClick,
  selectedRole,
  onRoleChange,
}: TeamGuideSidebarProps) {
  return (
    <div className="space-y-3 lg:hidden">
      <div className="flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {(['admin', 'team'] as const).map((role) => {
          const isActive = selectedRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => onRoleChange(role)}
              className={`
                flex-1 rounded-md px-3 py-2 text-fluid-sm font-semibold transition-all
                ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}
              `}
            >
              {HELP_ROLE_LABELS[role]}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="mb-1 block text-fluid-xs font-medium text-slate-600">장 바로가기</span>
        <select
          value={activeChapter || ''}
          onChange={(e) => {
            if (e.target.value) onChapterClick(e.target.value);
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <option value="">장 선택…</option>
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.id}. {chapter.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
