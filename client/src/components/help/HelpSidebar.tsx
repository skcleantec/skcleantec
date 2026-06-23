import type { HelpModuleGroup } from '../../types/helpContent';
import { helpModuleDomId } from '../../utils/helpContent';

type HelpSidebarProps = {
  groups: HelpModuleGroup[];
  activeModule: string | null;
  onModuleClick: (module: string) => void;
};

export function HelpSidebar({ groups, activeModule, onModuleClick }: HelpSidebarProps) {
  const scrollToModule = (module: string) => {
    onModuleClick(module);
    const el = document.getElementById(helpModuleDomId(module));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside className="sticky top-24 h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-slate-200 pb-3">
        <h2 className="text-lg font-bold text-slate-900">📑 목차</h2>
      </div>

      <nav aria-label="모듈 목록">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-fluid-xs text-slate-500">표시할 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {groups.map((group) => {
              const active = activeModule === group.module;
              return (
                <li key={group.module}>
                  <button
                    type="button"
                    onClick={() => scrollToModule(group.module)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-fluid-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="block">{group.module}</span>
                    <span className="text-fluid-xs opacity-75">
                      {group.items.length}개 항목
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}

/** 모바일용 모듈 점프 — lg 미만 */
export function HelpMobileModuleSelect({
  groups,
  activeModule,
  onModuleChange,
}: {
  groups: HelpModuleGroup[];
  activeModule: string | null;
  onModuleChange: (module: string) => void;
}) {
  if (groups.length === 0) return null;

  const handleChange = (module: string) => {
    if (!module) return;
    onModuleChange(module);
    const el = document.getElementById(helpModuleDomId(module));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <label className="block lg:hidden">
      <span className="mb-1 block text-fluid-xs font-medium text-slate-600">모듈 바로가기</span>
      <select
        value={activeModule || ''}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <option value="">모듈 선택…</option>
        {groups.map((group) => (
          <option key={group.module} value={group.module}>
            {group.module} ({group.items.length})
          </option>
        ))}
      </select>
    </label>
  );
}

export { helpModuleDomId };
