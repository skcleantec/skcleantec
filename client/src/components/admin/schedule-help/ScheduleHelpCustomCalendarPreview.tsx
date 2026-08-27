import { customCalendarColorTokens } from '../../../constants/customCalendarColors';
import { ScheduleHelpAnnotatedPanel } from './ScheduleHelpAnnotatedPanel';
import { SCHEDULE_HELP_CUSTOM_UI_CALLOUTS } from './scheduleHelpScreenshots';

const MOCK_REGION_CALENDARS = [
  { id: 'demo-gangnam', name: '강남', colorKey: 'violet', active: true },
  { id: 'demo-songpa', name: '송파', colorKey: 'sky', active: false },
] as const;

/** PC 왼쪽(접수 검색·맞춤 캘린더) + 달력 탭 — 실제 UI 구조 미리보기 */
export function ScheduleHelpCustomCalendarPreview() {
  return (
    <figure className="space-y-2">
      <ScheduleHelpAnnotatedPanel
        callouts={SCHEDULE_HELP_CUSTOM_UI_CALLOUTS}
        className="pointer-events-none select-none bg-slate-100/80"
        contentClassName="p-2"
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,42%)_minmax(0,58%)] sm:items-start">
          <div className="space-y-2 min-w-0">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-2.5 py-2">
                <h3 className="font-semibold text-slate-900 text-[13px] leading-tight">접수 검색</h3>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">고객명 · 전화 · 접수번호 · 주소</p>
              </div>
              <div className="px-2.5 py-2">
                <div className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-400">
                  2자 이상 입력
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-2 py-1.5">
                <h3 className="font-semibold text-slate-900 text-[13px] leading-tight">맞춤 캘린더</h3>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">지역 · 업체 · 파트너 필터</p>
              </div>
              <div className="space-y-2 px-2 py-1.5">
                <div className="flex w-full items-center justify-between rounded border border-dashed border-slate-300 bg-slate-50/80 px-2 py-1 min-h-[28px]">
                  <span className="text-[12px] font-semibold text-slate-800">캘린더 추가</span>
                  <span className="text-base font-light leading-none text-slate-600">+</span>
                </div>
                <div className="flex w-full items-center gap-1 rounded px-1 py-0.5 min-h-[26px] font-semibold text-slate-900">
                  <span className="w-2 text-center text-[11px] text-slate-400">—</span>
                  <span className="text-[12px]">전체</span>
                </div>
                <div>
                  <p className="mb-1 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400/80">지역별</p>
                  <ul className="space-y-0.5">
                    {MOCK_REGION_CALENDARS.map((cal) => {
                      const t = customCalendarColorTokens(cal.colorKey);
                      return (
                        <li key={cal.id}>
                          <div
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 min-h-[34px] ${
                              cal.active ? 'bg-blue-50/80 font-semibold text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full border border-black/10 ${t.dot}`} />
                            <span className="truncate text-[12px]">{cal.name}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 px-1 text-[12px] font-bold uppercase tracking-wider text-slate-400/80">업체별</p>
                  <p className="pl-3 py-1 text-[11px] text-slate-400">등록된 캘린더 없음</p>
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50/80 px-2 py-1.5 text-center text-[11px] font-medium text-slate-500">
                서비스 권역 관리
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-end gap-0.5 overflow-x-auto bg-slate-100 px-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 rounded-t-md border border-slate-200 border-b-white bg-white px-2 py-0.5 text-[11px] font-medium text-slate-900">
                전체
              </span>
              {MOCK_REGION_CALENDARS.map((cal) => {
                const t = customCalendarColorTokens(cal.colorKey);
                return (
                  <span
                    key={`tab-${cal.id}`}
                    className={`shrink-0 rounded-t-md border px-2 py-0.5 text-[11px] font-medium ${
                      cal.active ? `${t.tabActive} border-b-transparent` : `${t.tabIdle} border-transparent border-b-slate-200`
                    }`}
                  >
                    {cal.name}
                  </span>
                );
              })}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200/90 p-px">
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div key={w} className="bg-slate-50 px-0.5 py-1 text-center text-[9px] font-semibold text-slate-500">
                  {w}
                </div>
              ))}
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="min-h-[2.25rem] bg-white p-0.5 text-[8px] text-slate-400">
                  {i >= 2 ? i - 1 : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScheduleHelpAnnotatedPanel>

      <figcaption className="text-fluid-2xs text-slate-500 leading-snug">
        번호는 화면 위치, 오른쪽 박스는 설명입니다. 선으로 연결되어 있습니다. 좁은 화면에서는{' '}
        <strong className="text-slate-700">≡</strong> 메뉴에서 접수 검색·맞춤 캘린더를 엽니다.
      </figcaption>
    </figure>
  );
}
