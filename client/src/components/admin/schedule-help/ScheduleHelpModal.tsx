import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { HelpUiTokenId } from '@shared/helpUiTokens';
import { customCalendarColorTokens } from '../../../constants/customCalendarColors';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { HelpUiEmbed } from '../../help/ui/helpUiRegistry';
import {
  ScheduleCloseDayButton,
  ScheduleReleaseDayButton,
  ScheduleToolbarButton,
  scheduleLeaderAdjustButtonClass,
  scheduleStaffAdjustButtonClass,
} from '../../schedule/scheduleUiParts';
import { SonEomneungNalIcon } from '../../schedule/SonEomneungNalIcon';
import { ModalCloseButton } from '../ModalCloseButton';
import { ScheduleHelpCustomCalendarAddFlowPreview } from './ScheduleHelpCustomCalendarAddFlowPreview';
import { ScheduleHelpCustomCalendarPreview } from './ScheduleHelpCustomCalendarPreview';
import { ScheduleHelpDayListPreview } from './ScheduleHelpDayListPreview';
import { ScheduleHelpScreenshotFigure } from './ScheduleHelpScreenshotFigure';
import {
  buildScheduleListCardColorHelpRows,
  buildScheduleListSectionHelpRows,
} from './ScheduleListColorLegendSamples';
import { ScheduleLegendItems } from './ScheduleLegendItems';
import {
  SCHEDULE_HELP_CALENDAR_CALLOUTS,
  SCHEDULE_HELP_SCREENSHOTS,
} from './scheduleHelpScreenshots';
import {
  SCHEDULE_HELP_TABS,
  SCHEDULE_MARKETPLACE_SECTION_HELP,
  SCHEDULE_PAGE_OVERVIEW_HELP,
  SCHEDULE_UNASSIGNED_SECTION_HELP,
  type ScheduleHelpTabId,
} from './scheduleHelpShared';

type Props = {
  open: boolean;
  onClose: () => void;
};

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2.5">
      <h3 className="text-fluid-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function HelpTable({ rows }: { rows: ReadonlyArray<{ sample: ReactNode; meaning: string }> }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[16rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-1.5 pr-3 text-left font-medium">화면 표시</th>
            <th className="py-1.5 text-left font-medium">의미</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3 text-slate-800">{row.sample}</td>
              <td className="py-2 text-slate-600 leading-snug">{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HelpUiRow({ tokenId, meaning }: { tokenId: HelpUiTokenId; meaning: string }) {
  return { sample: <HelpUiEmbed tokenId={tokenId} />, meaning };
}

/** 도움말용 달력 칸 미리보기 (예시 숫자) */
function ScheduleHelpCalendarCellDemo() {
  const chip = customCalendarColorTokens('teal');
  return (
    <div className="mx-auto w-full max-w-[9.5rem] rounded-xl border border-slate-200/80 bg-white px-2 py-1.5 shadow-sm">
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-0.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white tabular-nums">
            15
          </span>
          <SonEomneungNalIcon />
        </span>
        <span className="text-[10px] font-semibold text-rose-600">일</span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        <div className="flex overflow-hidden rounded-md border border-slate-200/50 text-[9px] font-bold tabular-nums">
          <div className="flex flex-1 items-center justify-between bg-amber-50 px-1 py-0.5 text-amber-900">
            <span>AM</span>
            <span>2</span>
          </div>
          <div className="flex flex-1 items-center justify-between border-l border-slate-200/50 bg-sky-50 px-1 py-0.5 text-sky-900">
            <span>PM</span>
            <span>1</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500">
          <span className="flex items-center gap-0.5">
            <span aria-hidden>👥</span>
            <span>팀원</span>
          </span>
          <span className="font-bold text-slate-700">4</span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-semibold text-red-600">
          <span className="flex items-center gap-0.5">
            <span aria-hidden>⚠️</span>
            <span>미배</span>
          </span>
          <span className="font-bold">1</span>
        </div>
        <div className="flex justify-center sm:justify-between items-center text-[9px] sm:text-[10px] font-semibold text-violet-700 leading-none shrink-0">
          <span className="flex items-center gap-0.5">
            <span className="text-[9px]" aria-hidden>
              ⚡
            </span>
            <span>사이</span>
          </span>
          <span className="font-bold">1</span>
        </div>
        <div className="flex justify-center sm:justify-between items-center text-[9px] sm:text-[10px] font-semibold text-teal-800 leading-none shrink-0 motion-safe:animate-pulse">
          <span className="flex items-center gap-0.5">
            <span className="text-[9px]" aria-hidden>
              ◇
            </span>
            <span>조율</span>
          </span>
          <span className="font-bold">1</span>
        </div>
        <span className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-semibold ${chip.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
          <span className="truncate max-w-[4rem]">강남</span>
          <span className="font-bold">3</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" title="미제출" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="보류" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" title="취소" />
      </div>
    </div>
  );
}

function ScheduleHelpCalendarTab() {
  return (
    <div className="space-y-4">
      <p className="text-fluid-xs sm:text-fluid-sm text-slate-600 leading-relaxed">{SCHEDULE_PAGE_OVERVIEW_HELP}</p>

      <HelpSection title="실제 화면 (달력)">
        <ScheduleHelpScreenshotFigure
          src={SCHEDULE_HELP_SCREENSHOTS.calendarOverview}
          alt="스케줄 달력 — 범례·맞춤 탭·날짜 칸 숫자"
          caption="PC 스케줄 화면입니다. 노란 번호는 아래 설명과 같습니다. 모바일은 달력 아래에 선택일 목록이 이어집니다."
          callouts={SCHEDULE_HELP_CALENDAR_CALLOUTS}
        />
      </HelpSection>

      <HelpSection title="달력 칸 예시 (확대)">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <ScheduleHelpCalendarCellDemo />
          <ul className="min-w-0 flex-1 list-disc space-y-1 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
            <li>
              <strong className="text-slate-800">AM / PM 숫자</strong> — 팀장 오전·오후 남은 자리(휴무 반영).{' '}
              <strong className="text-rose-700">0보다 작으면</strong> 배정 초과입니다.
            </li>
            <li>
              <strong className="text-slate-800">👥 팀원</strong> — 그날 가용 크루 잔여 인원입니다.
            </li>
            <li>
              <strong className="text-slate-800">⚠️ 미배</strong> — 시간대는 정해졌지만 팀장이 없는 자사 접수입니다.
            </li>
            <li>
              <strong className="text-slate-800">⚡ 사이</strong> — 사이청소인데 오전/오후가 아직 확정되지 않은 미배정 건입니다.
            </li>
            <li>
              <strong className="text-slate-800">◇ 조율</strong> — 조율인데 오전/오후가 아직 확정되지 않은 미배정 건입니다. 달력에서 깜빡입니다.
            </li>
            <li>
              <strong className="text-slate-800">색 칩 + 숫자</strong> — 맞춤 캘린더·지역 필터에 맞는 접수 건수입니다.
            </li>
            <li>
              <strong className="text-slate-800">아래 작은 점</strong> — 그날 미제출·보류·취소 접수가 있다는 뜻입니다.
            </li>
          </ul>
        </div>
      </HelpSection>

      <HelpSection title="범례 (실제 화면과 동일)">
        <ScheduleLegendItems />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          범례 옆 <span className="font-semibold">?</span> 에서 슬롯·사이청소·조율 설명을 더 볼 수 있습니다.
        </p>
      </HelpSection>

      <HelpSection title="숫자·표시 상세">
        <HelpTable
          rows={[
            {
              sample: (
                <span className="inline-flex overflow-hidden rounded-md border border-slate-200 text-[10px] font-bold">
                  <span className="bg-amber-50 px-1.5 py-0.5 text-amber-900">AM 2</span>
                  <span className="border-l border-slate-200 bg-sky-50 px-1.5 py-0.5 text-sky-900">PM 1</span>
                </span>
              ),
              meaning: '오전·오후 팀장 배정 가능 잔여. 사이청소·조율을 오전/오후로 확정하면 해당 숫자가 줄어듭니다.',
            },
            {
              sample: (
                <span className="inline-flex overflow-hidden rounded-md border border-slate-200 text-[10px] font-bold">
                  <span className="bg-rose-50 px-1.5 py-0.5 text-rose-700">AM -1</span>
                </span>
              ),
              meaning: '슬롯 초과 — 「인원조정」「팀장조정」으로 일정을 맞춰 주세요.',
            },
            {
              sample: (
                <span className="text-[10px] font-semibold text-slate-500">
                  <span aria-hidden>👥</span> 팀원 4
                </span>
              ),
              meaning: '휴무를 뺀 크루 잔여. 표준 접수는 팀원 2명 단위로 집계됩니다.',
            },
            {
              sample: <span className="text-[10px] font-semibold text-slate-500">마감</span>,
              meaning: '「일정마감」으로 막아 둔 날 또는 구간입니다.',
            },
            {
              sample: (
                <span className="inline-flex items-center gap-1">
                  <SonEomneungNalIcon />
                  <span className="text-fluid-2xs">손없는날</span>
                </span>
              ),
              meaning: '업체 관행상 작업을 피하는 날(음력 9·10·19·20·29·30)입니다.',
            },
          ]}
        />
      </HelpSection>
    </div>
  );
}

function ScheduleHelpListTab() {
  const scheduleUiRows = [
    HelpUiRow({ tokenId: 'schedule-badge-am', meaning: '오전 시간대 접수' }),
    HelpUiRow({ tokenId: 'schedule-badge-pm', meaning: '오후 시간대 접수' }),
    HelpUiRow({ tokenId: 'schedule-badge-side', meaning: '사이청소 (오전·오후 확정 전)' }),
    HelpUiRow({ tokenId: 'schedule-badge-coordination', meaning: '조율 (오전·오후 확정 전, 목록에서 깜빡임)' }),
    HelpUiRow({ tokenId: 'schedule-badge-unassigned', meaning: '2행 요약 — 팀장 없음' }),
    HelpUiRow({ tokenId: 'schedule-marketplace-cart', meaning: '정보공유 등록 중 — 마우스를 올리면 단계 표시' }),
  ];

  const sectionColorRows = buildScheduleListSectionHelpRows();
  const cardColorRows = buildScheduleListCardColorHelpRows();

  return (
    <div className="space-y-4">
      <p className="text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2">
        아래 색 설명은 <strong className="text-slate-800">달력 범례</strong>와 다릅니다.{' '}
        <strong className="text-slate-800">선택한 날 일정 목록</strong>의 구역·카드 칸 색을 뜻합니다.
      </p>

      <HelpSection title="선택한 날 — 목록 미리보기 (실제 UI)">
        <ScheduleHelpDayListPreview />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          PC에서는 달력 <strong className="text-slate-700">오른쪽</strong>, 모바일에서는 달력{' '}
          <strong className="text-slate-700">아래</strong>에 같은 구조의 목록이 나타납니다. 카드를 누르면 접수
          상세 모달이 열립니다.
        </p>
      </HelpSection>

      <HelpSection title="목록 구역 색 (위 → 아래)">
        <HelpTable rows={sectionColorRows} />
      </HelpSection>

      <HelpSection title="접수 카드 칸 색">
        <HelpTable rows={cardColorRows} />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          카드 왼쪽 <strong className="text-slate-700">굵은 띠</strong>와 배경색은 같은 시간대(오전·오후·사이·조율)를
          나타냅니다. 팀장 1건 강조·처리 전·보류·취소 표시는 시간대 색 위에 겹쳐집니다.
        </p>
      </HelpSection>

      <HelpSection title="목록 구역 순서 (위 → 아래)">
        <ol className="list-decimal space-y-1 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>
            <span className="font-semibold text-rose-800">팀장 미배정</span> — 미배정·오전 / ·오후 / ·사이·조율·미확정
          </li>
          <li>
            <span className="font-semibold text-violet-800">정보공유</span> — 정보공유에 올린 접수 (기능 사용 시)
          </li>
          <li>
            <span className="font-semibold text-amber-800">오전 일정</span> ·{' '}
            <span className="font-semibold text-sky-800">오후 일정</span> ·{' '}
            <span className="font-semibold text-violet-800">사이/조율 · 일정 미확정</span>
          </li>
          <li>
            <span className="font-semibold text-indigo-800">파트너 / 타업체</span> — 접기로 업체별 묶음
          </li>
          <li>
            <span className="font-semibold text-slate-700">취소·보류</span> — 하단 선반 (일반 일정과 분리)
          </li>
          <li>
            <span className="font-semibold text-red-800">A/S (C/S 예정)</span> — 예약 청소와 별도 후속 일정
          </li>
        </ol>
        <div className="mt-2 space-y-1 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-fluid-2xs text-slate-600 leading-snug">
          <p>
            <span className="font-semibold text-slate-800">팀장 미배정</span> — {SCHEDULE_UNASSIGNED_SECTION_HELP}
          </p>
          <p>
            <span className="font-semibold text-slate-800">정보공유</span> — {SCHEDULE_MARKETPLACE_SECTION_HELP}
          </p>
        </div>
      </HelpSection>

      <HelpSection title="접수 카드 — 실제 아이콘·배지">
        <HelpTable rows={scheduleUiRows} />
        <HelpTable
          rows={[
            {
              sample: (
                <span className="inline-flex gap-1">
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">아</span>
                  <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-800">원</span>
                </span>
              ),
              meaning: '건물 유형(아파트·원룸 등) 스티커',
            },
            {
              sample: <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-900">수기</span>,
              meaning: '대시보드·간편 수기 등록 접수',
            },
            {
              sample: (
                <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                  해피콜 완료
                </span>
              ),
              meaning: '작업 전날 밤까지 해피콜 완료 (팀장 배정·예약일 있을 때)',
            },
            {
              sample: <span className="font-bold text-rose-600 text-[10px]">미제출</span>,
              meaning: '발주서 미제출 등 아직 본 일정이 아닌 접수',
            },
            {
              sample: (
                <span className="rounded-md border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  메모
                </span>
              ),
              meaning: '일정 메모 — 눌러 빠르게 편집',
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="선택한 날 — 상단 버튼">
        <div className="flex flex-wrap items-center gap-2 pointer-events-none select-none">
          <ScheduleToolbarButton className={scheduleStaffAdjustButtonClass} tabIndex={-1} aria-hidden disabled>
            인원조정
          </ScheduleToolbarButton>
          <ScheduleToolbarButton className={scheduleLeaderAdjustButtonClass} tabIndex={-1} aria-hidden disabled>
            팀장조정
          </ScheduleToolbarButton>
          <ScheduleToolbarButton
            className="px-2 py-1 text-fluid-2xs font-medium rounded border border-slate-300 bg-white text-slate-800"
            tabIndex={-1}
            aria-hidden
            disabled
          >
            배정현황
          </ScheduleToolbarButton>
          <ScheduleCloseDayButton tabIndex={-1} aria-hidden disabled />
          <ScheduleReleaseDayButton tabIndex={-1} aria-hidden disabled />
        </div>
        <HelpTable
          rows={[
            HelpUiRow({ tokenId: 'schedule-btn-staff-adjust', meaning: '그날 접수 오전↔오후↔사이·조율 시간대 변경' }),
            HelpUiRow({ tokenId: 'schedule-btn-leader-adjust', meaning: '팀장 배정·교체' }),
            HelpUiRow({ tokenId: 'schedule-btn-close', meaning: '선택한 날(또는 오전/오후만) 신규 배정 막기' }),
            HelpUiRow({ tokenId: 'schedule-btn-close-release', meaning: '일정마감 해제' }),
            HelpUiRow({ tokenId: 'schedule-btn-map', meaning: '그날 접수 위치 지도' }),
            {
              sample: (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-lg font-light text-slate-700">
                  +
                </span>
              ),
              meaning: '선택한 날짜로 새 접수 등록',
            },
          ]}
        />
      </HelpSection>
    </div>
  );
}

function ScheduleHelpCustomTab() {
  const chip = customCalendarColorTokens('violet');
  return (
    <div className="space-y-4">
      <HelpSection title="실제 화면 (PC 왼쪽 · 달력 탭)">
        <ScheduleHelpCustomCalendarPreview />
      </HelpSection>

      <p className="text-fluid-xs sm:text-fluid-sm text-slate-600 leading-relaxed">
        <strong className="text-slate-800">전체</strong> 달력은 모든 접수를 보여 줍니다.{' '}
        <strong className="text-slate-800">맞춤 캘린더</strong>는 지역·타업체·파트너 기준으로 필터한 보기를 내 계정에
        저장합니다. 탭을 고르면 달력·목록이 해당 접수만 표시됩니다.
      </p>

      <HelpSection title="추가하는 방법">
        <ScheduleHelpCustomCalendarAddFlowPreview />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          권한이 없으면 관리자에게 「스케줄 · 맞춤 캘린더」 권한을 요청하세요.
        </p>
      </HelpSection>

      <HelpSection title="만들 때 입력 항목">
        <HelpTable
          rows={[
            {
              sample: <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${chip.tabActive}`}>강남</span>,
              meaning: '캘린더 이름 — 상단 탭·달력 칩에 표시됩니다.',
            },
            {
              sample: <span className="text-fluid-2xs text-slate-700">서비스 권역 연결</span>,
              meaning: '권역별 팀장 규칙과 연동. 「서비스 권역 관리」에서 먼저 설정합니다.',
            },
            {
              sample: <span className="text-fluid-2xs text-slate-700">시·구 선택</span>,
              meaning: '해당 행정구역 접수만 달력·목록에 표시',
            },
            {
              sample: <span className="text-fluid-2xs text-slate-700">타업체 / 파트너 선택</span>,
              meaning: '협력 업체·파트너 연계 접수만 모아 보기',
            },
            {
              sample: (
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${chip.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                  5
                </span>
              ),
              meaning: '색상 — 탭과 달력 칸 배지에 같은 색이 쓰입니다.',
            },
          ]}
        />
        <ul className="list-disc space-y-1 pl-4 text-fluid-2xs text-slate-600 leading-snug">
          <li>
            <strong className="text-slate-800">배정된 건은 지역 배지에서 제외</strong> — 셀 숫자 집계 방식 변경
          </li>
          <li>
            <strong className="text-slate-800">전체에서 숨기고 이 캘린더에서만</strong> — 집중 뷰 (다른 접수는 전체 달력에서 숨김)
          </li>
          <li>
            <strong className="text-slate-800">← 전체</strong> 또는 「전체」 탭 — 기본 달력으로 돌아갑니다.
          </li>
        </ul>
      </HelpSection>
    </div>
  );
}

export function ScheduleHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<ScheduleHelpTabId>('calendar');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTab('calendar');
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="schedule-help-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-xl bg-white shadow-xl border border-slate-200 max-h-[min(92vh,44rem)] sm:max-h-[min(92vh,42rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4 pr-14 sm:px-5 sm:pt-5">
          <h2 id="schedule-help-modal-title" className="text-fluid-base sm:text-lg font-semibold text-slate-900">
            스케줄 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs sm:text-fluid-xs text-slate-500">
            달력 숫자·일정 목록·맞춤 캘린더 사용법
          </p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="도움말 섹션"
          >
            {SCHEDULE_HELP_TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-fluid-2xs sm:text-fluid-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5"
          onFocusCapture={onFieldFocus}
        >
          {tab === 'calendar' ? <ScheduleHelpCalendarTab /> : null}
          {tab === 'list' ? <ScheduleHelpListTab /> : null}
          {tab === 'custom' ? <ScheduleHelpCustomTab /> : null}
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:px-5 bg-slate-50/80">
          <Link
            to="/help"
            className="text-fluid-2xs sm:text-fluid-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded"
          >
            도움말 센터에서 더 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs sm:text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    root,
  );
}
