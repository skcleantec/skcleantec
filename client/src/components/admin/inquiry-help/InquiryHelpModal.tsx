import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { HelpUiTokenId } from '@shared/helpUiTokens';
import {
  INQUIRY_EDIT_SECTION_TITLE_HINTS,
} from '../../../constants/inquiryEditSectionOrder';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { HelpUiEmbed } from '../../help/ui/helpUiRegistry';
import { ModalCloseButton } from '../ModalCloseButton';
import { CustomerNameWithInternalTone } from '../CustomerNameWithInternalTone';
import { InquiryDbMarketplaceBadge } from '../InquiryDbMarketplaceBadge';
import { OperatingCompanyBadge } from '../OperatingCompanyBadge';
import { TenantInquiryShareBadge } from '../TenantInquiryShareBadge';
import {
  ProfOptionsAmountReviewBadge,
  ProfOptionsAmountReviewCompletedBadge,
} from '../../inquiry/ProfOptionsAmountReviewNotice';
import { InspectionProgressBadge } from '../../inquiry-inspection/InspectionProgressBadge';
import {
  InquiryOrderPendingHint,
  InquiryStatusChipPreview,
} from '../../inquiries/inquiriesUiParts';
import { InquiryHelpListFullPreview } from './InquiryHelpListFullPreview';
import { InquiryHelpZoomableFigure } from './InquiryHelpZoomableFigure';
import {
  INQUIRY_HELP_DEMO,
  INQUIRY_HELP_DEMO_DB_LISTING,
  INQUIRY_HELP_DEMO_INSPECTION,
  INQUIRY_HELP_DEMO_SHARE_SOURCE,
} from './inquiryHelpDemoData';
import { INQUIRY_HELP_LIST_CALLOUTS, INQUIRY_HELP_SCREENSHOTS } from './inquiryHelpScreenshots';
import {
  INQUIRY_HELP_DETAIL_ASSIGNMENT_MODEL,
  INQUIRY_HELP_DETAIL_CLAIM_ACTIONS,
  INQUIRY_HELP_DETAIL_COPY_SHEET_ACTIONS,
  INQUIRY_HELP_DETAIL_FAB_ACTIONS,
  INQUIRY_HELP_DETAIL_FOOTER_ACTIONS,
  INQUIRY_HELP_DETAIL_HEADER_ACTIONS,
  INQUIRY_HELP_DETAIL_MARKETPLACE_ACTIONS,
  INQUIRY_HELP_DETAIL_PARTNER_ACTIONS,
  INQUIRY_HELP_DETAIL_PRE_SECTION1_ACTIONS,
  INQUIRY_HELP_DETAIL_AFTER_ORDER_PHOTOS_ACTIONS,
  INQUIRY_HELP_DETAIL_AFTER_SCHEDULE_ACTIONS,
  INQUIRY_HELP_DETAIL_SECTION_ACTIONS,
  type InquiryHelpActionRow,
} from './inquiryHelpDetailActions';
import { InquiryHelpDetailSectionFigure } from './InquiryHelpDetailSectionPreview';
import {
  INQUIRY_HELP_DETAIL_SECTION_PREVIEW,
  type InquiryHelpDetailPreviewId,
} from './inquiryHelpDetailScreenshots';
import {
  INQUIRY_HELP_DETAIL_SECTIONS,
  INQUIRY_HELP_INQUIRY_NUMBER_ROWS,
  INQUIRY_HELP_PIN_TIER_ROWS,
  INQUIRY_HELP_STATUS_ROWS,
  INQUIRY_HELP_TABS,
  INQUIRY_PAGE_OVERVIEW_HELP,
  type InquiryHelpTabId,
} from './inquiryHelpShared';

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
            <th className="py-1.5 text-left font-medium">의미 · 사용</th>
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

const HELP_ACTION_BTN =
  'inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold leading-tight text-slate-800 shadow-sm';

function HelpActionTable({ rows }: { rows: readonly InquiryHelpActionRow[] }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[18rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-1.5 pr-3 text-left font-medium w-[38%]">버튼 · UI</th>
            <th className="py-1.5 text-left font-medium">기능 · 사용 시점</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3">
                <span className={HELP_ACTION_BTN}>{row.label}</span>
                {row.when ? (
                  <p className="mt-1 text-[11px] text-violet-700 leading-snug">표시: {row.when}</p>
                ) : null}
              </td>
              <td className="py-2 text-slate-600 leading-snug">{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InquiryHelpListTab() {
  return (
    <div className="space-y-4">
      <p className="text-fluid-xs sm:text-fluid-sm text-slate-600 leading-relaxed">{INQUIRY_PAGE_OVERVIEW_HELP}</p>

      <HelpSection title="목록 한눈에 보기 (모든 아이콘·열·버튼)">
        <InquiryHelpListFullPreview />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          아래 표는 위 예시에 나온 표시를 하나씩 설명합니다. 실제 고객 정보는 예시처럼 ○○·마스킹된 데모만 사용합니다.
        </p>
      </HelpSection>

      <HelpSection title="접수번호 — 어디에 보이고 어떻게 쓰나요?">
        <p className="text-fluid-2xs text-slate-600 leading-snug">
          접수번호는 <strong className="text-slate-800">별도 버튼이 아닙니다</strong>. 식별·검색·상세 이동에 쓰입니다.
        </p>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[16rem] border-collapse text-fluid-2xs sm:text-fluid-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5 pr-3 text-left font-medium">위치</th>
                <th className="py-1.5 text-left font-medium">사용법</th>
              </tr>
            </thead>
            <tbody>
              {INQUIRY_HELP_INQUIRY_NUMBER_ROWS.map((row) => (
                <tr key={row.where} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-800">{row.where}</td>
                  <td className="py-2 text-slate-600 leading-snug">{row.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-fluid-2xs text-slate-600">
          <span className="font-mono tabular-nums text-slate-500">{INQUIRY_HELP_DEMO.inquiryNumber}</span>
          <span>← PC 접수일 아래 · 모바일 검은 칩과 동일 번호</span>
        </div>
      </HelpSection>

      <HelpSection title="실제 화면 캡처 (참고)">
        <InquiryHelpZoomableFigure
          zoomImageSrc={INQUIRY_HELP_SCREENSHOTS.listOverview}
          zoomImageAlt="서비스접수 목록 전체"
          caption="운영 화면 캡처입니다. 「크게 보기」로 확대할 수 있습니다. 아이콘·배지는 위 데모 예시와 함께 보세요."
          callouts={INQUIRY_HELP_LIST_CALLOUTS}
        >
          <img
            src={INQUIRY_HELP_SCREENSHOTS.listOverview}
            alt="서비스접수 목록 전체"
            className="block w-full h-auto"
            loading="lazy"
          />
        </InquiryHelpZoomableFigure>
      </HelpSection>

      <HelpSection title="상단 고정(tier) · 행 배경색">
        <HelpTable
          rows={INQUIRY_HELP_PIN_TIER_ROWS.map((r) => ({
            sample: (
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${r.color}`} />
                {r.label}
              </span>
            ),
            meaning: r.meaning,
          }))}
        />
        <HelpTable
          rows={[
            {
              sample: <span className="text-[11px] text-rose-700">행 연한 빨강</span>,
              meaning: '해피콜 기한 초과(HC초과) — 팀장 배정·예약일 있을 때',
            },
            {
              sample: <span className="text-[11px] text-amber-700">행 노란 테두리</span>,
              meaning: '해피콜 대기 또는 보류(ON_HOLD)',
            },
            HelpUiRow({ tokenId: 'inq-hint-pin-pending', meaning: '미제출 pin tier — rose 계열 강조' }),
          ]}
        />
      </HelpSection>

      <HelpSection title="상단 등록 · 빠른 작업">
        <HelpTable
          rows={[
            HelpUiRow({ tokenId: 'inq-btn-manual', meaning: '수동접수 — 스케줄과 동일 상세 폼으로 즉시 등록' }),
            {
              sample: (
                <span className="inline-flex min-h-8 items-center rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[12px] font-medium text-sky-700">
                  일반 등록
                </span>
              ),
              meaning: '부재·보류·입금 워크플로 — AdminListIntakeModal',
            },
            {
              sample: <span className="text-fluid-2xs font-medium text-violet-800">빠른 붙여넣기</span>,
              meaning: '카카오·문자 내용 붙여넣어 필드 자동 채우기',
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="필터 · 집계">
        <HelpTable
          rows={[
            HelpUiRow({ tokenId: 'inq-date-preset', meaning: '당일 · 전체 · 월별 · 날짜 — 접수일/예약일 기준과 함께 사용' }),
            HelpUiRow({ tokenId: 'inq-btn-marketer-daily', meaning: '마케터별 「내역」— 예약완료·접수일 기준 일별 건수' }),
            {
              sample: <span className="text-fluid-2xs text-slate-700">접수자 · 팀장 · 현장검수 · 브랜드 · 유입</span>,
              meaning: '드롭다운 필터. 마케터 집계 클릭 시 접수자·상태·날짜가 URL에 반영됨',
            },
            {
              sample: <span className="text-fluid-2xs text-slate-700">검색 + 조회</span>,
              meaning: '고객명·연락처·접수번호·주소 — 검색 시 기간이 전체로 넓혀짐',
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="상태 아이콘 (열 · StatusQuickPicker)">
        <HelpTable
          rows={INQUIRY_HELP_STATUS_ROWS.map((s) => ({
            sample: (
              <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium">
                <span aria-hidden>{s.icon}</span>
                {s.label}
              </span>
            ),
            meaning: s.meaning,
          }))}
        />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          상태 칸을 누르면 허용된 다음 상태로 빠르게 변경합니다. ▾ 드롭다운과 동일합니다.
        </p>
      </HelpSection>

      <HelpSection title="행 · 카드 — 아이콘·배지·표시 (전체)">
        <HelpTable
          rows={[
            {
              sample: (
                <span className="font-mono text-fluid-2xs tabular-nums text-slate-500">{INQUIRY_HELP_DEMO.inquiryNumber}</span>
              ),
              meaning: '접수번호 — PC는 접수일 아래, 모바일은 검은 칩. 검색·상세 연동(별도 버튼 없음)',
            },
            {
              sample: <OperatingCompanyBadge company={INQUIRY_HELP_DEMO.operatingCompany} />,
              meaning: '영업 브랜드(운영사) — 관리자 설정 색상 칩',
            },
            {
              sample: <TenantInquiryShareBadge share={INQUIRY_HELP_DEMO_SHARE_SOURCE} compact />,
              meaning: '파트너 연계 — SOURCE(내가 연계) / TARGET(받은 접수). 정보공유 경로면 「정보공유」 칩 추가',
            },
            {
              sample: <InquiryDbMarketplaceBadge dbListing={INQUIRY_HELP_DEMO_DB_LISTING} iconOnly />,
              meaning: '정보공유(DB 마켓) 등록 — 카트 아이콘에 마우스를 올리면 단계(준비·공유중 등) 표시',
            },
            HelpUiRow({ tokenId: 'schedule-marketplace-cart', meaning: '위 카트와 동일 아이콘 — 도움말 토큰 미리보기' }),
            {
              sample: (
                <CustomerNameWithInternalTone
                  name={INQUIRY_HELP_DEMO.customerName}
                  tone="GOOD"
                  viewerRole="ADMIN"
                />
              ),
              meaning: '고객명 + 내부 톤 이모지(관리자·마케터만). GOOD·BAD 등 내부 구분',
            },
            {
              sample: <span className="text-amber-600 font-bold">●</span>,
              meaning: '클레임 접수 — 클레임 메모가 있을 때 고객명 옆 주황 점',
            },
            {
              sample: (
                <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-800 ring-1 ring-violet-200">
                  cbiseo
                </span>
              ),
              meaning: '유입(리드) 플랫폼 — cbiseo·네이버·숨고 등',
            },
            {
              sample: (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-slate-200">
                  입주
                </span>
              ),
              meaning: '서비스 유형 칩 — 입주·에어컨 등(에어컨은 하늘색)',
            },
            HelpUiRow({ tokenId: 'inq-hint-order-pending', meaning: '발주서 미제출 안내 — 상태 아래 작은 글씨' }),
            {
              sample: <InquiryStatusChipPreview status="RECEIVED" />,
              meaning: '상태 칩 + ▾ — 클릭 시 허용된 다음 상태로 빠른 변경(StatusQuickPicker)',
            },
            {
              sample: (
                <span className="inline-flex gap-0.5">
                  <span className="rounded bg-emerald-100 px-1 text-[11px] font-bold text-emerald-800">O</span>
                  <span className="rounded bg-slate-100 px-1 text-[11px] font-bold text-slate-400">X</span>
                </span>
              ),
              meaning: '특이사항 · 사진첨부 — 고객 발주서 기준 O/X(관리자 6번 특이와 별개)',
            },
            {
              sample: <InspectionProgressBadge summary={INQUIRY_HELP_DEMO_INSPECTION} variant="list" />,
              meaning: '현장검수 모듈 사용 시 — 진행·완료·누락 등(미사용 시 —)',
            },
            {
              sample: <ProfOptionsAmountReviewBadge />,
              meaning: '전문시공 옵션 금액 — 검토 필요',
            },
            {
              sample: <ProfOptionsAmountReviewCompletedBadge />,
              meaning: '전문시공 옵션 금액 — 검토 완료',
            },
            {
              sample: (
                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]">홍팀장</span>
              ),
              meaning: '팀장 열 — 드롭다운으로 배정·변경(권한·상태에 따름)',
            },
            HelpUiRow({ tokenId: 'inq-btn-call', meaning: '모바일 카드 우측 — tel: 전화(행 클릭과 분리)' }),
            {
              sample: <InquiryOrderPendingHint />,
              meaning: '미제출 행 — 「고객 발송」과 함께 쓰는 발주서 미제출 힌트',
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="표 열 (PC) · 빠른 수정">
        <ol className="list-decimal space-y-1 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>
            <strong className="text-slate-800">접수일 · 접수자 · 서비스 · 유입 · 고객 · 연락처 · 주소</strong> — 식별·연락
          </li>
          <li>
            <strong className="text-slate-800">평수 · 예약일 · 시간·거리</strong> — 셀 더블클릭 시 빠른 수정 모달
          </li>
          <li>
            <strong className="text-slate-800">상태 · 특이사항 · 사진첨부 · (현장검수) · 팀장 · 작업</strong>
          </li>
        </ol>
      </HelpSection>

      <HelpSection title="작업 열 · 모바일 하단 버튼 (상태별)">
        <HelpTable
          rows={[
            {
              sample: <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">고객 발송</span>,
              meaning: '미제출 — 메시지·발주 링크·새 창 미리보기 통합 모달',
            },
            {
              sample: <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700">입금완료</span>,
              meaning: '입금대기 행 — 입금 확인 처리',
            },
            {
              sample: <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-600">수정</span>,
              meaning: '접수 상세와 동일 폼 — 빠른 수정',
            },
            {
              sample: <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-700">클레임</span>,
              meaning: '클레임 메모 등록·보기',
            },
            {
              sample: <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">발주서</span>,
              meaning: '발주서 열기·재발송',
            },
            {
              sample: <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600">삭제</span>,
              meaning: '비밀번호 확인 후 삭제(역할·상태에 따름)',
            },
          ]}
        />
        <ul className="list-disc space-y-1 pl-4 text-fluid-2xs sm:text-fluid-xs text-slate-600 leading-snug">
          <li>
            <strong className="text-slate-800">미제출</strong> — 「고객 발송」, 삭제
          </li>
          <li>
            <strong className="text-slate-800">입금대기</strong> — 입금완료 · 메모 · 삭제
          </li>
          <li>
            <strong className="text-slate-800">입금완료</strong> — 발주서 · 수정 · 취소 · 삭제
          </li>
          <li>
            <strong className="text-slate-800">그 외</strong> — 발주서 · 수정 · 클레임 · 취소 · C/S 처리중은 「완료」
          </li>
        </ul>
        <p className="text-fluid-2xs text-slate-500">
          <strong className="text-slate-700">행·카드 본문 클릭</strong> → 접수 상세 모달(「접수 상세」 탭 참고).{' '}
          <strong className="text-slate-700">모바일 전화</strong> 버튼만 tel: 링크로 분리됩니다.
        </p>
      </HelpSection>
    </div>
  );
}

function detailActionBlocksForSection(secNum: number) {
  if (secNum === 4) {
    return INQUIRY_HELP_DETAIL_SECTION_ACTIONS.filter((s) => s.title.startsWith('4. 정산'));
  }
  return INQUIRY_HELP_DETAIL_SECTION_ACTIONS.filter((s) => s.title.startsWith(`${secNum}.`));
}

function InquiryHelpDetailSectionContent({ secNum }: { secNum: number }) {
  const sec = INQUIRY_HELP_DETAIL_SECTIONS.find((s) => s.num === secNum);
  if (!sec) return null;
  const previewId = INQUIRY_HELP_DETAIL_SECTION_PREVIEW[secNum];
  const actionBlocks = detailActionBlocksForSection(secNum);
  return (
    <>
      {previewId ? <InquiryHelpDetailSectionFigure id={previewId} /> : null}
      <p className="text-fluid-2xs text-slate-500 leading-snug">{sec.summary}</p>
      <p className="text-fluid-2xs font-medium text-slate-700">필드</p>
      <HelpTable
        rows={sec.fields.map((f) => ({
          sample: <span className="font-medium text-slate-800">{f.name}</span>,
          meaning: f.desc,
        }))}
      />
      {actionBlocks.length > 0 ? (
        <>
          <p className="text-fluid-2xs font-medium text-slate-700 pt-1">버튼 · 액션</p>
          {actionBlocks.map((block) => (
            <div key={block.title} className="space-y-2">
              {block.intro ? <p className="text-fluid-2xs text-slate-500 leading-snug">{block.intro}</p> : null}
              <HelpActionTable rows={block.rows} />
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}

function InquiryHelpDetailSubBlock({
  title,
  previewId,
  intro,
  actions,
  children,
}: {
  title: string;
  previewId?: InquiryHelpDetailPreviewId;
  intro?: string;
  actions?: readonly InquiryHelpActionRow[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
      <p className="text-fluid-2xs font-semibold text-slate-800">{title}</p>
      {previewId ? <InquiryHelpDetailSectionFigure id={previewId} /> : null}
      {intro ? <p className="text-fluid-2xs text-slate-600 leading-snug">{intro}</p> : null}
      {children}
      {actions && actions.length > 0 ? <HelpActionTable rows={actions} /> : null}
    </div>
  );
}

function InquiryHelpDetailTab() {
  return (
    <div className="space-y-4">
      <p className="text-fluid-xs sm:text-fluid-sm text-slate-600 leading-relaxed">
        아래 설명은 <strong className="text-slate-800">접수 수정 모달을 위에서 아래로 스크롤</strong>할 때 보이는 순서와
        같습니다. 스케줄에서 여는 상세와 동일합니다. 각 블록 상단 <strong className="text-slate-800">화면 예시</strong>는
        「크게 보기」로 확대할 수 있습니다.
      </p>

      <HelpSection title="모달 헤더 · 보기 · 복사">
        <InquiryHelpDetailSectionFigure id="header" />
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_HEADER_ACTIONS} />
        <InquiryHelpDetailSubBlock
          title="「보기」 — 고객 정보 시트"
          previewId="copy-sheet"
          actions={INQUIRY_HELP_DETAIL_COPY_SHEET_ACTIONS}
        />
      </HelpSection>

      <HelpSection title="오른쪽 FAB — 섹션 점프">
        <InquiryHelpDetailSectionFigure id="fab" />
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_FAB_ACTIONS} />
        <ol className="mt-2 grid gap-1 sm:grid-cols-2 text-fluid-2xs text-slate-700 list-none">
          {INQUIRY_EDIT_SECTION_TITLE_HINTS.map((hint, i) => (
            <li key={hint} className="flex gap-1.5">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
                {i + 1}
              </span>
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      </HelpSection>

      <HelpSection title="본문 시작 — 신규 접수 · 금액 설정 배너 (해당 시)">
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          <strong className="text-slate-700">1. 고객 · 주소</strong> 카드 바로 위에, 조건에 따라 아래가 먼저 보입니다.
        </p>
        <InquiryHelpDetailSectionFigure id="create-intake" />
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_PRE_SECTION1_ACTIONS} />
      </HelpSection>

      <HelpSection title="1. 고객 · 주소">
        <InquiryHelpDetailSectionContent secNum={1} />
      </HelpSection>

      <HelpSection title="2. 유형 · 면적 · 방·주방">
        <InquiryHelpDetailSectionContent secNum={2} />
      </HelpSection>

      <HelpSection title="3. 일정">
        <InquiryHelpDetailSectionContent secNum={3} />
      </HelpSection>

      <HelpSection title="내 추가 캘린더 (번호 없음 · 3번 다음)">
        <InquiryHelpDetailSectionFigure id="custom-calendar" />
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_AFTER_SCHEDULE_ACTIONS} />
      </HelpSection>

      <HelpSection title="4. 정산 · 옵션">
        <InquiryHelpDetailSectionContent secNum={4} />
        <InquiryHelpDetailSubBlock
          title="4번 안 — 파트너에 접수 연계 (직접 1곳)"
          previewId="partner"
          intro="접기 블록 「파트너에 접수 연계」입니다. 타업체 담당·정보공유와 배타 규칙이 있습니다."
          actions={INQUIRY_HELP_DETAIL_PARTNER_ACTIONS}
        />
        <InquiryHelpDetailSubBlock
          title="4번 안 — 정보공유 DB 마켓 (여러 업체)"
          previewId="marketplace"
          intro="공유 준비 → 노출 대상 → 정보공유 게시 → (인수) → 인계 확정 순으로 진행합니다."
          actions={INQUIRY_HELP_DETAIL_MARKETPLACE_ACTIONS}
        />
      </HelpSection>

      <HelpSection title="5. 결제 금액 내역 (추가결재)">
        <InquiryHelpDetailSectionContent secNum={5} />
      </HelpSection>

      <HelpSection title="6. 상태 · 배정 · 팀원 · 메모">
        <InquiryHelpDetailSectionContent secNum={6} />
        <InquiryHelpDetailSubBlock
          title="배정·넘기기 — 네 가지 방식 (4번·6번 관계)"
          previewId="assignment-overview"
          intro="자사 팀장(6번) · 타업체(4번) · 파트너 직접 연계(4번) · 정보공유(4번)는 동시에 쓸 수 없는 조합이 있습니다."
          actions={INQUIRY_HELP_DETAIL_ASSIGNMENT_MODEL}
        />
      </HelpSection>

      <HelpSection title="7. 상담·참고 (사진·마케터 메모)">
        <InquiryHelpDetailSectionContent secNum={7} />
      </HelpSection>

      <HelpSection title="클레임 (참고 · 번호 없음 · 7번 다음)">
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_CLAIM_ACTIONS} />
      </HelpSection>

      <HelpSection title="8. 발주서 첨부 사진 (고객 업로드)">
        <InquiryHelpDetailSectionContent secNum={8} />
      </HelpSection>

      <HelpSection title="견적서 (번호 없음 · 8번 다음)">
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_AFTER_ORDER_PHOTOS_ACTIONS} />
      </HelpSection>

      <HelpSection title="9. 현장 검수·완료">
        <InquiryHelpDetailSectionContent secNum={9} />
      </HelpSection>

      <HelpSection title="10. 현장 사진 (청소 전·후)">
        <InquiryHelpDetailSectionContent secNum={10} />
      </HelpSection>

      <HelpSection title="11. 날짜·금액 변경 이력">
        <InquiryHelpDetailSectionContent secNum={11} />
      </HelpSection>

      <HelpSection title="하단 · 저장 · 삭제">
        <InquiryHelpDetailSectionFigure id="footer" />
        <HelpActionTable rows={INQUIRY_HELP_DETAIL_FOOTER_ACTIONS} />
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          <strong className="text-slate-700">3번</strong> 고객 발주서 특이사항과{' '}
          <strong className="text-slate-700">6번</strong> 특이사항(관리자 메모)은 별도입니다. 목록 O/X는 고객
          발주서·첨부 사진 기준입니다.
        </p>
      </HelpSection>
    </div>
  );
}

export function InquiryHelpModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<InquiryHelpTabId>('list');
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
    if (open) setTab('list');
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="inquiry-help-modal-title"
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
          <h2 id="inquiry-help-modal-title" className="text-fluid-base sm:text-lg font-semibold text-slate-900">
            서비스접수 도움말
          </h2>
          <p className="mt-1 text-fluid-2xs sm:text-fluid-xs text-slate-500">접수 목록 · 접수 상세 사용법</p>
          <div
            className="mt-3 inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="도움말 섹션"
          >
            {INQUIRY_HELP_TABS.map((t) => {
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
          {tab === 'list' ? <InquiryHelpListTab /> : null}
          {tab === 'detail' ? <InquiryHelpDetailTab /> : null}
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
