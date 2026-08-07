import { CUSTOM_CALENDAR_COLOR_LABEL_KO, customCalendarColorTokens } from '../../../constants/customCalendarColors';
import { ScheduleHelpAnnotatedPanel } from './ScheduleHelpAnnotatedPanel';
import type { ScheduleHelpCalloutDef } from './ScheduleHelpAnnotatedPanel';

const ADD_MENU_CALLOUTS: ScheduleHelpCalloutDef[] = [
  { id: 1, label: '캘린더 추가 — 종류 선택 메뉴 열기', anchorX: 52, anchorY: 22 },
  { id: 2, label: '지역 캘린더 — 시·구·권역 필터', anchorX: 52, anchorY: 38 },
  { id: 3, label: '업체 / 파트너 — 협력·연계 접수', anchorX: 52, anchorY: 54 },
];

const CREATE_MODAL_CALLOUTS: ScheduleHelpCalloutDef[] = [
  { id: 1, label: '캘린더 이름 — 탭·달력 칩에 표시', anchorX: 48, anchorY: 14 },
  { id: 2, label: '서비스 권역 연결(선택)', anchorX: 48, anchorY: 30 },
  { id: 3, label: '시·구 선택 — 필터 지역', anchorX: 48, anchorY: 50 },
  { id: 4, label: '탭 색상 — 달력에서 구분', anchorX: 48, anchorY: 72 },
  { id: 5, label: '생성 — 저장 후 탭·목록에 추가', anchorX: 78, anchorY: 92 },
];

function StepHeading({ n, title }: { n: string; title: string }) {
  return (
    <p className="text-fluid-2xs sm:text-fluid-xs font-semibold text-slate-800">
      <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
        {n}
      </span>
      {title}
    </p>
  );
}

function SidebarAddMenuMock() {
  return (
    <div className="mx-auto max-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-2 py-1.5">
        <h3 className="text-[12px] font-semibold text-slate-900">맞춤 캘린더</h3>
      </div>
      <div className="space-y-1 px-2 py-1.5">
        <div className="flex w-full items-center justify-between rounded border border-dashed border-sky-300 bg-sky-50/80 px-2 py-1 min-h-[28px]">
          <span className="text-[11px] font-semibold text-sky-900">캘린더 추가</span>
          <span className="text-base font-light leading-none text-sky-700">−</span>
        </div>
        <ul className="space-y-0.5 rounded border border-slate-100 bg-slate-50/80 px-1 py-1">
          <li className="rounded bg-violet-50 px-1.5 py-1 text-[11px] font-medium text-violet-900">— 지역 캘린더</li>
          <li className="px-1.5 py-1 text-[11px] text-slate-700">— 업체 캘린더</li>
          <li className="px-1.5 py-1 text-[11px] text-slate-700">— 파트너 캘린더</li>
        </ul>
      </div>
    </div>
  );
}

function CreateModalMock() {
  const violet = customCalendarColorTokens('violet');
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <h3 className="text-fluid-sm font-semibold text-slate-900">지역 캘린더 추가</h3>
        <p className="mt-0.5 text-[10px] text-slate-500 leading-snug">지역·서비스 권역 기준으로 접수를 필터링할 캘린더를 만듭니다.</p>
      </div>
      <div className="space-y-2 p-3 sm:p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <p className="mb-1 text-[11px] font-medium text-slate-800">캘린더 이름</p>
          <div className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-900">강남·송파</div>
        </div>
        <div className={`rounded-lg border p-2.5 space-y-1.5 ${violet.tabIdle}`}>
          <p className="text-[11px] font-medium text-slate-800">서비스 권역 연결</p>
          <div className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-700">연결 안 함 (지역 직접 선택)</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
          <p className="text-[11px] font-medium text-slate-800">시 · 구 선택</p>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700">서울 강남구</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700">서울 송파구</span>
          </div>
          <label className="flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-700">
            <span className="inline-block h-3.5 w-3.5 rounded border border-slate-300 bg-white" />
            배정된 건은 지역 배지(건수)에서 제외
          </label>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-slate-800">탭 색상</p>
          <div className="flex gap-1.5">
            {(['teal', 'violet', 'rose'] as const).map((key) => {
              const t = customCalendarColorTokens(key);
              const active = key === 'violet';
              return (
                <div
                  key={key}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1 ${
                    active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-transparent'
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full border border-black/10 ${t.dot}`} />
                  <span className="text-[8px] text-slate-600">{CUSTOM_CALENDAR_COLOR_LABEL_KO[key]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-1.5 pt-0.5">
          <span className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[11px] text-slate-700">취소</span>
          <span className="rounded bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white">생성</span>
        </div>
      </div>
    </div>
  );
}

function MobileMenuMock() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-900">≡ 맞춤 캘린더 메뉴</p>
        <p className="text-[10px] text-slate-500">접수 검색 · 캘린더 추가 · 필터 목록</p>
      </div>
    </div>
  );
}

/** 맞춤 캘린더 추가 — 단계별 UI 미리보기 */
export function ScheduleHelpCustomCalendarAddFlowPreview() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <StepHeading n="1" title="PC — 왼쪽 「맞춤 캘린더」에서 「캘린더 추가」" />
        <ScheduleHelpAnnotatedPanel callouts={ADD_MENU_CALLOUTS} className="pointer-events-none select-none" contentClassName="py-3">
          <SidebarAddMenuMock />
        </ScheduleHelpAnnotatedPanel>
      </div>

      <div className="space-y-2">
        <StepHeading n="2" title="종류 선택 후 — 추가 모달에서 이름·지역·색상 입력 → 「생성」" />
        <ScheduleHelpAnnotatedPanel callouts={CREATE_MODAL_CALLOUTS} className="pointer-events-none select-none" contentClassName="py-2">
          <CreateModalMock />
        </ScheduleHelpAnnotatedPanel>
      </div>

      <div className="space-y-2">
        <StepHeading n="3" title="모바일 — 상단 ≡ 메뉴에서 같은 흐름" />
        <MobileMenuMock />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          좁은 화면에서는 왼쪽 패널 대신 <strong className="text-slate-700">≡</strong> 버튼 시트에서 접수 검색·캘린더
          추가·필터 목록을 엽니다. 생성 후 달력 위 <strong className="text-slate-700">색 탭</strong>으로 빠르게 전환합니다.
        </p>
      </div>
    </div>
  );
}
