import { HelpTooltip } from '../../ui/HelpTooltip';
import {
  ISSUE_FILL_RULES_PAGE_HELP,
  ISSUE_FORM_SECTION_TABS,
  type IssueFormSectionId,
} from '@shared/orderFormFillRules';

const TAB_BTN =
  'shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-fluid-2xs font-medium sm:px-2.5 sm:py-1.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const TAB_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const TAB_OFF = 'bg-white text-slate-700 border border-slate-200';
const SETTINGS_FOCUS =
  'shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-fluid-2xs font-medium sm:text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Props = {
  section: IssueFormSectionId;
  settingsOpen: boolean;
  onSection: (id: IssueFormSectionId) => void;
  onToggleSettings: () => void;
};

export function IssueFormSectionTabs({ section, settingsOpen, onSection, onToggleSettings }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5">
          {ISSUE_FORM_SECTION_TABS.map((tab) => {
            const on = !settingsOpen && section === tab.id;
            return (
              <span key={tab.id} className="inline-flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  className={`${TAB_BTN} ${on ? TAB_ON : TAB_OFF}`}
                  aria-pressed={on}
                  onClick={() => onSection(tab.id)}
                >
                  {tab.label}
                </button>
                <HelpTooltip className="shrink-0" text={tab.help} />
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className={`${SETTINGS_FOCUS} ${settingsOpen ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}
          aria-pressed={settingsOpen}
          onClick={onToggleSettings}
        >
          설정
        </button>
        <HelpTooltip className="shrink-0" text={ISSUE_FILL_RULES_PAGE_HELP} />
      </div>
    </div>
  );
}
