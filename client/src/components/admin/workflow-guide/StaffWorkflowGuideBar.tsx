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
import { StaffWorkflowGuideDetail } from './StaffWorkflowGuideDetail';
import { activeWorkflowStepId, workflowStepsFor, type WorkflowGuideStep } from './workflowGuideSteps';

const BAR =
  'rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.05)]';

const TITLE =
  'shrink-0 text-fluid-2xs font-semibold tracking-tight text-slate-900';

const CHIP_BASE =
  'shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-fluid-2xs font-medium tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const CHIP_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const CHIP_OFF = 'text-slate-500 hover:bg-slate-50 hover:text-slate-800';

const TEXT_BTN =
  'shrink-0 rounded-md px-1.5 py-0.5 text-fluid-2xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Props = {
  surface: WorkflowGuideSurface;
};

function StepChips({
  steps,
  activeId,
  onStep,
}: {
  steps: readonly WorkflowGuideStep[];
  activeId: string;
  onStep: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
      <span className={TITLE}>이용 순서</span>
      <span className="hidden h-3 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
      {steps.map((step, i) => {
        const on = step.id === activeId;
        return (
          <span key={step.id} className="flex shrink-0 items-center gap-1.5">
            {i > 0 ? <span className="h-px w-3 shrink-0 bg-slate-200" aria-hidden /> : null}
            <button
              type="button"
              className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
              aria-pressed={on}
              onClick={() => onStep(step.id)}
            >
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-fluid-2xs tabular-nums ${
                  on ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {step.n}
              </span>
              {step.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

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

  return (
    <div className={BAR}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <StepChips steps={steps} activeId={activeId} onStep={onStep} />
          {collapsed ? null : <StaffWorkflowGuideDetail step={activeStep} />}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <button
            type="button"
            className={TEXT_BTN}
            onClick={() => setWorkflowGuideCollapsed(surface, !collapsed)}
          >
            {collapsed ? '설명 보기' : '접기'}
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
