import type { HelpRole } from '../../types/helpContent';
import { HELP_ROLE_LABELS, helpModuleDomId } from '../../utils/helpContent';

type HelpSidebarProps = {
  role: HelpRole;
  onRoleChange: (role: HelpRole) => void;
  modules: string[];
  moduleOrderByName: Map<string, number>;
  activeModule: string | null;
  onModuleClick: (module: string) => void;
  className?: string;
};

export function HelpSidebar({
  role,
  onRoleChange,
  modules,
  moduleOrderByName,
  activeModule,
  onModuleClick,
  className = '',
}: HelpSidebarProps) {
  const roles: HelpRole[] = ['admin', 'crew'];

  return (
    <aside className={`flex flex-col bg-slate-900 text-white ${className}`}>
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-fluid-xs uppercase tracking-wider text-slate-400">청소비서</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">사용법 · Q&amp;A</h2>
      </div>

      <div className="border-b border-white/10 p-3">
        <div className="flex rounded-xl bg-slate-800 p-1" role="tablist" aria-label="역할 선택">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => onRoleChange(r)}
              className={`flex-1 rounded-lg px-2 py-2 text-fluid-xs font-medium transition-colors ${
                role === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              {HELP_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="모듈 목록">
        {modules.length === 0 ? (
          <p className="px-2 py-3 text-fluid-xs text-slate-400">표시할 모듈이 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {[...modules]
              .sort((a, b) => (moduleOrderByName.get(a) ?? 0) - (moduleOrderByName.get(b) ?? 0))
              .map((module) => {
                const active = activeModule === module;
                return (
                  <li key={module}>
                    <button
                      type="button"
                      onClick={() => onModuleClick(module)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-fluid-sm transition-colors ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {module}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </nav>

      <div className="border-t border-white/10 p-3 text-[10px] text-slate-500">
        모듈을 누르면 해당 섹션으로 이동합니다.
      </div>
    </aside>
  );
}

/** 모바일용 모듈 점프 — lg 미만 */
export function HelpMobileModuleSelect({
  modules,
  moduleOrderByName,
  value,
  onChange,
}: {
  modules: string[];
  moduleOrderByName: Map<string, number>;
  value: string;
  onChange: (module: string) => void;
}) {
  if (modules.length === 0) return null;

  const sorted = [...modules].sort(
    (a, b) => (moduleOrderByName.get(a) ?? 0) - (moduleOrderByName.get(b) ?? 0)
  );

  return (
    <label className="block lg:hidden">
      <span className="mb-1 block text-fluid-xs font-medium text-slate-600">모듈 바로가기</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <option value="">모듈 선택…</option>
        {sorted.map((module) => (
          <option key={module} value={module}>
            {module}
          </option>
        ))}
      </select>
    </label>
  );
}

export { helpModuleDomId };
