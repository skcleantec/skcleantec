import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getWorkflowGuideState,
  requestInquiryEditSectionScroll,
  setWorkflowGuideCollapsed,
  setWorkflowGuideHidden,
  WORKFLOW_GUIDE_CHANGE_EVENT,
  type WorkflowGuideSurface,
} from '../../../utils/staffWorkflowGuideStorage';
import { activeWorkflowStepId, workflowStepsFor } from './workflowGuideSteps';

const CHIP =
  'shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-fluid-2xs font-medium hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const CHIP_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const CHIP_OFF = 'border border-slate-200 bg-white text-slate-700';
const TEXT_BTN =
  'shrink-0 rounded-md px-1.5 py-0.5 text-fluid-2xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Props = {
  surface: WorkflowGuideSurface;
};

export function StaffWorkflowGuideBar({ surface }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = workflowStepsFor(surface);
  const [hidden, setHidden] = useState(() => getWorkflowGuideState(surface).hidden);
  const [collapsed, setCollapsed] = useState(() => getWorkflowGuideState(surface).collapsed);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const s = getWorkflowGuideState(surface);
      setHidden(s.hidden);
      setCollapsed(s.collapsed);
    };
    window.addEventListener(WORKFLOW_GUIDE_CHANGE_EVENT, sync);
    return () => window.removeEventListener(WORKFLOW_GUIDE_CHANGE_EVENT, sync);
  }, [surface]);

  const activeId = useMemo(
    () => activeWorkflowStepId(surface, location.pathname, selectedId),
    [surface, location.pathname, selectedId],
  );
  const activeStep = steps.find((s) => s.id === activeId) ?? steps[0];

  const onStep = useCallback(
    (id: string) => {
      const step = steps.find((s) => s.id === id);
      if (!step) return;
      setSelectedId(id);
      if (step.scrollSection) requestInquiryEditSectionScroll(step.scrollSection);
      if (step.to && location.pathname !== step.to) {
        navigate(step.to);
      }
    },
    [location.pathname, navigate, steps],
  );

  if (hidden) return null;

  if (collapsed) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <button type="button" className={TEXT_BTN} onClick={() => setWorkflowGuideCollapsed(surface, false)}>
          이용 순서
        </button>
        <p className="min-w-0 truncate text-fluid-2xs text-slate-500">번호를 눌러 다음 화면으로 갑니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 overflow-x-auto overscroll-x-contain pb-0.5">
            <span className="shrink-0 text-fluid-2xs font-semibold text-slate-600">이용 순서</span>
            {steps.map((step) => {
              const on = step.id === activeId;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                  aria-pressed={on}
                  onClick={() => onStep(step.id)}
                >
                  <span className="tabular-nums">{step.n}</span>
                  {step.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">{activeStep.tip}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <button type="button" className={TEXT_BTN} onClick={() => setWorkflowGuideCollapsed(surface, true)}>
            접기
          </button>
          <button
            type="button"
            className={TEXT_BTN}
            onClick={() => {
              if (window.confirm('이 브라우저에서 이용 순서 안내를 숨길까요? 페이지 설정에서 다시 켤 수 있습니다.')) {
                setWorkflowGuideHidden(surface, true);
              }
            }}
          >
            다시 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
