/** 서비스접수·스케줄 이용 순서 막대 — 브라우저(localStorage)에만 저장 */

export type WorkflowGuideSurface = 'inquiry' | 'schedule';

export const WORKFLOW_GUIDE_CHANGE_EVENT = 'cbiseo:workflow-guide-change';
export const WORKFLOW_GUIDE_SCROLL_EVENT = 'cbiseo:workflow-guide-scroll';

const STORAGE_KEY = 'cbiseo.workflowGuide.v1';

type SurfaceState = { hidden: boolean; collapsed: boolean };
type Store = Record<WorkflowGuideSurface, SurfaceState>;

const DEFAULT_SURFACE: SurfaceState = { hidden: false, collapsed: false };

function emptyStore(): Store {
  return { inquiry: { ...DEFAULT_SURFACE }, schedule: { ...DEFAULT_SURFACE } };
}

function readStore(): Store {
  const next = emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Partial<Store>;
    for (const key of ['inquiry', 'schedule'] as const) {
      const row = parsed[key];
      if (row && typeof row === 'object') {
        next[key] = {
          hidden: row.hidden === true,
          collapsed: row.collapsed === true,
        };
      }
    }
  } catch {
    /* Safari 사설 모드 등 */
  }
  return next;
}

function writeStore(store: Store): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WORKFLOW_GUIDE_CHANGE_EVENT));
}

export function getWorkflowGuideState(surface: WorkflowGuideSurface): SurfaceState {
  return readStore()[surface];
}

export function setWorkflowGuideHidden(surface: WorkflowGuideSurface, hidden: boolean): void {
  const store = readStore();
  store[surface] = { ...store[surface], hidden };
  writeStore(store);
}

export function setWorkflowGuideCollapsed(surface: WorkflowGuideSurface, collapsed: boolean): void {
  const store = readStore();
  store[surface] = { ...store[surface], collapsed };
  writeStore(store);
}

export function requestInquiryEditSectionScroll(section: 'status' | 'settlement'): void {
  window.dispatchEvent(new CustomEvent(WORKFLOW_GUIDE_SCROLL_EVENT, { detail: { section } }));
}
