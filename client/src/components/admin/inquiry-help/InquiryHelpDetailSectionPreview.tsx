import type { ReactNode } from 'react';
import { TenantInquiryShareBadge } from '../TenantInquiryShareBadge';
import { OperatingCompanyBadge } from '../OperatingCompanyBadge';
import { InquiryDbMarketplaceBadge } from '../InquiryDbMarketplaceBadge';
import { InquiryStatusChipPreview } from '../../inquiries/inquiriesUiParts';
import { ProfOptionsAmountReviewBadge } from '../../inquiry/ProfOptionsAmountReviewNotice';
import {
  inqEditInput,
  inqEditLabel,
  inqEditSectionBody,
  inqEditSectionHeader,
  inqEditSectionShell,
  inqEditSubCard,
  inqEditSubCardTitle,
} from '../inquiry-edit/inquiryEditFormClasses';
import {
  INQUIRY_HELP_DEMO,
  INQUIRY_HELP_DEMO_DB_LISTING,
  INQUIRY_HELP_DEMO_SHARE_SOURCE,
} from './inquiryHelpDemoData';
import {
  INQUIRY_HELP_DETAIL_PREVIEW_CAPTION,
  type InquiryHelpDetailPreviewId,
} from './inquiryHelpDetailScreenshots';
import { InquiryHelpZoomableFigure } from './InquiryHelpZoomableFigure';

function MockSec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${inqEditSectionShell} pointer-events-none select-none`}>
      <h3 className={inqEditSectionHeader}>{title}</h3>
      <div className={inqEditSectionBody}>{children}</div>
    </section>
  );
}

function F({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className={inqEditLabel}>{label}</label>
      <div className={`${inqEditInput} truncate text-slate-700`}>{value}</div>
    </div>
  );
}

function Btn({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'violet' | 'indigo';
}) {
  const cls =
    variant === 'primary'
      ? 'bg-slate-900 text-white border-transparent'
      : variant === 'danger'
        ? 'border-rose-300 bg-rose-50 text-rose-800'
        : variant === 'violet'
          ? 'border-violet-300 bg-violet-50 text-violet-900'
          : variant === 'indigo'
            ? 'border-indigo-300 bg-indigo-600 text-white'
            : 'border-slate-200 bg-white text-slate-800';
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function PreviewRoot({ enlarged, children }: { enlarged?: boolean; children: ReactNode }) {
  return (
    <div className={`pointer-events-none select-none ${enlarged ? 'text-fluid-xs' : 'text-[11px] sm:text-fluid-2xs'}`}>
      {children}
    </div>
  );
}

const mockSelectCompact =
  'min-w-0 rounded border border-gray-300 bg-white px-1 py-0.5 text-fluid-2xs text-slate-900';

function MockYmdCompact({ y, m, d }: { y: number; m: number; d: number }) {
  return (
    <div className="inline-flex min-w-0 flex-1 items-center gap-0.5">
      <select className={mockSelectCompact} disabled aria-hidden tabIndex={-1}>
        <option>{y}</option>
      </select>
      <span className="text-fluid-2xs text-gray-600">년</span>
      <select className={mockSelectCompact} disabled aria-hidden tabIndex={-1}>
        <option>{m}</option>
      </select>
      <span className="text-fluid-2xs text-gray-600">월</span>
      <select className={mockSelectCompact} disabled aria-hidden tabIndex={-1}>
        <option>{d}</option>
      </select>
      <span className="text-fluid-2xs text-gray-600">일</span>
    </div>
  );
}

function MockScheduleSectionPreview({ enlarged = false }: { enlarged?: boolean }) {
  const label = enlarged ? 'text-fluid-sm font-semibold text-slate-700 mb-1.5' : 'text-fluid-xs font-semibold text-slate-700 mb-1';
  const link = enlarged ? 'text-fluid-xs font-medium text-blue-600' : 'text-[11px] font-medium text-blue-600';
  const boxPad = enlarged ? 'p-3 sm:p-4' : 'p-2 sm:p-3';
  const readBox = enlarged ? 'text-fluid-sm' : 'text-fluid-2xs';

  return (
    <MockSec title="3. 일정">
      <div className="space-y-3 sm:space-y-4">
        <div className={`rounded-xl border border-sky-100 bg-sky-50/40 ${boxPad}`}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 sm:mb-1.5">
                <label className={`block ${label}`}>예약일 (청소 희망일)</label>
                <span className={`shrink-0 ${link}`}>달력·분배 가능일 →</span>
              </div>
              <div className="flex items-stretch gap-2">
                <MockYmdCompact y={2026} m={8} d={12} />
              </div>
            </div>
            <div>
              <label className={`block ${label}`}>희망 시간대 및 시각</label>
              <div className="flex items-stretch gap-2">
                <select className={`w-1/2 ${mockSelectCompact}`} disabled aria-hidden tabIndex={-1}>
                  <option>오전</option>
                </select>
                <input
                  readOnly
                  disabled
                  tabIndex={-1}
                  placeholder="구체적 시각 (예: 10:30)"
                  className={`w-1/2 ${mockSelectCompact} placeholder:text-slate-400`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border border-slate-200 bg-slate-50/50 ${boxPad}`}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 sm:mb-1.5">
                <label className={`block ${label}`}>
                  이사 날짜
                  <span className="ml-1 font-normal text-slate-400">(선택)</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 sm:text-fluid-2xs">
                  <span className="inline-block h-3.5 w-3.5 rounded border border-slate-300 bg-white" />
                  미정 (추후 확정)
                </label>
              </div>
              <MockYmdCompact y={2026} m={8} d={20} />
            </div>
            <div>
              <label className={`block ${label}`}>신축/구축/인테리어/거주</label>
              <select className={`w-full ${mockSelectCompact}`} disabled aria-hidden tabIndex={-1}>
                <option>신축</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-0.5">
          <label className={`block ${label}`}>고객 발주서 특이사항 (읽기 전용)</label>
          <div
            className={`min-h-[2.5rem] whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 ${readBox}`}
          >
            엘리베이터 이용 가능 · 주차 협의 필요
          </div>
        </div>
      </div>
    </MockSec>
  );
}

export function InquiryHelpDetailSectionPreviewInner({
  id,
  enlarged = false,
}: {
  id: InquiryHelpDetailPreviewId;
  enlarged?: boolean;
}) {
  const t = enlarged ? 'text-fluid-2xs' : 'text-[10px]';

  switch (id) {
    case 'assignment-overview':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className={`grid gap-1.5 sm:grid-cols-2 ${t}`}>
            {[
              ['자사 팀장·팀원', '6번 배정'],
              ['타업체 담당', '4번 select — 파트너·정보공유와 배타'],
              ['파트너 직접 연계', '4번 — 1곳 mirror'],
              ['정보공유(마켓)', '4번 — 여러 업체 공개'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-white p-2">
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="mt-0.5 text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </PreviewRoot>
      );

    case 'header':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className="rounded-t-xl border border-b-0 border-slate-200 bg-white px-2 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className={`font-semibold text-slate-900 ${enlarged ? 'text-fluid-sm' : ''}`}>접수 수정</p>
                <p className={`mt-0.5 font-mono tabular-nums text-slate-500 ${t}`}>{INQUIRY_HELP_DEMO.inquiryNumber}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <OperatingCompanyBadge company={INQUIRY_HELP_DEMO.operatingCompany} />
                  <TenantInquiryShareBadge share={INQUIRY_HELP_DEMO_SHARE_SOURCE} compact />
                  <InquiryDbMarketplaceBadge dbListing={INQUIRY_HELP_DEMO_DB_LISTING} iconOnly />
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">HC완료</span>
                  <ProfOptionsAmountReviewBadge />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Btn>보기</Btn>
                <Btn>복사</Btn>
              </div>
            </div>
          </div>
        </PreviewRoot>
      );

    case 'copy-sheet':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className="rounded-xl border border-slate-200 bg-white p-2 space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className={`font-semibold text-slate-900 ${t}`}>고객 정보</span>
              <div className="flex gap-1">
                <Btn variant="primary">저장</Btn>
                <Btn>정보 복사</Btn>
              </div>
            </div>
            <pre className={`whitespace-pre-wrap text-slate-600 ${t}`}>
              {`고객: ${INQUIRY_HELP_DEMO.customerName}\n연락처: ${INQUIRY_HELP_DEMO.phone}\n주소: ${INQUIRY_HELP_DEMO.addressShort}\n예약: 08-12 (화) 오전`}
            </pre>
          </div>
        </PreviewRoot>
      );

    case 'partner':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="4. 정산 · 옵션">
            <details open className="rounded-lg border border-indigo-200 bg-indigo-50/40 px-2 py-1.5">
              <summary className={`cursor-default font-semibold text-indigo-900 ${t}`}>파트너에 접수 연계</summary>
              <div className="mt-2 space-y-2">
                <Btn variant="violet">정보공유로 등록하기</Btn>
                <div className="grid grid-cols-2 gap-2">
                  <F label="파트너 업체" value="클린파트너" />
                  <F label="파트너 수수료 (원)" value="50,000" />
                </div>
                <label className={`flex items-center gap-1 text-slate-700 ${t}`}>
                  <span className="inline-block h-3 w-3 rounded border border-slate-300 bg-white" />
                  고객·일정만 연계
                </label>
                <div className="flex flex-wrap gap-1">
                  <Btn variant="indigo">접수 연계</Btn>
                  <Btn>파트너 수수료 저장</Btn>
                  <Btn variant="danger">접수연계 취소</Btn>
                </div>
              </div>
            </details>
          </MockSec>
        </PreviewRoot>
      );

    case 'marketplace':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="4. 정산 · 옵션">
            <div className={`rounded-lg border border-violet-200 bg-violet-50/50 p-2 space-y-2 ${t}`}>
              <p className="font-semibold text-violet-950">정보공유 — 공유 등록</p>
              <F label="수수료 (원)" value="80,000" />
              <div className="flex flex-wrap gap-1">
                <Btn variant="violet">공유 준비</Btn>
                <Btn>노출 대상</Btn>
                <Btn variant="primary">정보공유 게시</Btn>
                <Btn>공유 철회</Btn>
              </div>
              <div className="flex flex-wrap gap-1 border-t border-violet-200/80 pt-2">
                <Btn variant="primary">인계 확정</Btn>
                <Btn variant="danger">인수 신청 거절</Btn>
              </div>
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'fab':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className="relative min-h-[7rem] rounded-lg border border-slate-200 bg-white">
            <div className="p-3 text-slate-400">… 접수 수정 본문 …</div>
            <div className="absolute right-1 top-4 flex flex-col items-center gap-0.5 rounded-full border border-slate-200 bg-white/95 p-0.5 shadow-sm">
              <span className="flex h-5 w-5 items-center justify-center text-slate-500">▲</span>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span
                  key={n}
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${n === 4 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {n}
                </span>
              ))}
              <span className="flex h-5 w-5 items-center justify-center text-slate-500">▼</span>
            </div>
          </div>
        </PreviewRoot>
      );

    case 'customer':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="1. 고객 · 주소">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <F label="성함" value={INQUIRY_HELP_DEMO.customerName} />
              <F label="유입(리드)" value="cbiseo" />
              <F label="연락처" value={INQUIRY_HELP_DEMO.phone} />
              <F label="주소 검색" value={INQUIRY_HELP_DEMO.addressShort} wide />
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'property':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="2. 유형 · 면적 · 방·주방">
            <div className="grid grid-cols-4 gap-2">
              <F label="방" value="3" />
              <F label="화" value="2" />
              <F label="베" value="2" />
              <F label="주방" value="1" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <F label="건축물 유형" value="아파트" />
              <F label="면적 기준" value="공급" />
              <F label="평수" value="33" />
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'schedule':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockScheduleSectionPreview enlarged={enlarged} />
        </PreviewRoot>
      );

    case 'settlement':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="4. 정산 · 옵션">
            <div className="grid grid-cols-3 gap-2">
              <F label="총액 (원)" value="550,000" />
              <F label="예약금 (원)" value="100,000" />
              <F label="잔금 (원)" value="450,000" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <F label="타업체 담당" value="선택 안 함 (자사 팀장만)" />
              <F label="타업체 수수료 (원)" value="—" />
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'extra-charges':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="5. 결제 금액 내역 (추가결재)">
            <details open className={inqEditSubCard}>
              <summary className={`${inqEditSubCardTitle} cursor-default`}>펼치기 · 추가결재</summary>
              <div className="mt-2 flex flex-wrap gap-1">
                <Btn>+1천</Btn>
                <Btn>+1만</Btn>
                <Btn variant="primary">저장</Btn>
              </div>
            </details>
          </MockSec>
        </PreviewRoot>
      );

    case 'status':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="6. 상태 · 배정 · 팀원 · 메모">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div>
                <label className={inqEditLabel}>상태</label>
                <InquiryStatusChipPreview status="ASSIGNED" />
              </div>
              <F label="담당 마케터" value={INQUIRY_HELP_DEMO.marketer} />
              <F label="영업 브랜드" value="프리미엄" />
            </div>
            <div className={`mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 ${t}`}>
              <div className="flex flex-wrap items-center gap-1">
                <F label="팀장" value={INQUIRY_HELP_DEMO.teamLeader} />
                <Btn>팀장변경</Btn>
                <Btn>+ 팀장·팀원 세트 추가</Btn>
              </div>
            </div>
            <div className="mt-2">
              <F label="특이사항" value="엘리베이터 없음 …" wide />
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'consultation':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="7. 상담·참고 (사진·마케터 메모)">
            <details open className={inqEditSubCard}>
              <summary className={`${inqEditSubCardTitle} cursor-default`}>파일에서 선택</summary>
              <Btn>이미지 선택 (여러 장)</Btn>
              <div className="mt-2 flex gap-1">
                {[1, 2].map((i) => (
                  <span key={i} className="h-10 w-10 rounded border border-slate-200 bg-slate-100" />
                ))}
              </div>
            </details>
          </MockSec>
        </PreviewRoot>
      );

    case 'order-photos':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="8. 발주서 첨부 사진 (고객 업로드)">
            <Btn>전체 보기 (3장)</Btn>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3].map((i) => (
                <span key={i} className="h-10 w-10 rounded border border-slate-200 bg-slate-100" />
              ))}
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'inspection':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="9. 현장 검수·완료">
            <div className="flex flex-wrap gap-1">
              <Btn>PDF 다운로드</Btn>
              <Btn>고객 열람 링크 복사</Btn>
              <Btn>이메일 재발송</Btn>
            </div>
            <p className={`mt-2 text-emerald-700 ${t}`}>검수 진행 · 전 2/4 · 후 0/4</p>
          </MockSec>
        </PreviewRoot>
      );

    case 'site-photos':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="10. 현장 사진 (청소 전·후)">
            <details open className={inqEditSubCard}>
              <summary className={`${inqEditSubCardTitle} cursor-default`}>사진 올리기</summary>
              <Btn>사진 올리기 (여러 장·카메라·갤러리)</Btn>
            </details>
          </MockSec>
        </PreviewRoot>
      );

    case 'history':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="11. 날짜·금액 변경 이력">
            <div className={`space-y-1 ${t} text-slate-600`}>
              <p>08-07 14:30 · 상태 RECEIVED → ASSIGNED</p>
              <p>08-06 11:02 · 예약일 변경</p>
              <p>08-06 10:15 · 접수 등록</p>
            </div>
          </MockSec>
        </PreviewRoot>
      );

    case 'create-intake':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className={`rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2 ${t}`}>
            <p className="font-medium text-slate-900">이 접수의 첫 단계</p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {['일반 접수', '예약금 대기', '부재 후속', '보류 후속'].map((label, i) => (
                <span
                  key={label}
                  className={`rounded-lg border px-2 py-1.5 text-center font-medium ${i === 0 ? 'border-blue-400 bg-blue-50 text-blue-950' : 'border-slate-200 bg-white'}`}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <ProfOptionsAmountReviewBadge />
              <Btn variant="primary">추가 시공 금액 저장</Btn>
            </div>
          </div>
        </PreviewRoot>
      );

    case 'custom-calendar':
      return (
        <PreviewRoot enlarged={enlarged}>
          <MockSec title="내 추가 캘린더">
            <label className={`flex items-center gap-1 text-slate-700 ${t}`}>
              <span className="inline-block h-3 w-3 rounded border border-slate-900 bg-slate-900" />
              VIP 권역 캘린더 · 수동
            </label>
            <label className={`mt-1 flex items-center gap-1 text-slate-600 ${t}`}>
              <span className="inline-block h-3 w-3 rounded border border-slate-300 bg-white" />
              강남 자동 캘린더
            </label>
          </MockSec>
        </PreviewRoot>
      );

    case 'extra-blocks':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className="space-y-2">
            <div className={`flex flex-wrap gap-1 ${t}`}>
              <Btn>일반 접수</Btn>
              <Btn>예약금 대기</Btn>
              <Btn>부재 후속</Btn>
            </div>
            <MockSec title="견적서">
              <Btn>+ 견적서 만들기</Btn>
            </MockSec>
            <div className={`rounded-lg border border-slate-200 bg-white p-2 ${t}`}>
              <p className="font-medium text-slate-800">내 추가 캘린더</p>
              <label className="mt-1 flex items-center gap-1 text-slate-600">
                <span className="inline-block h-3 w-3 rounded border border-slate-900 bg-slate-900" />
                VIP 권역 캘린더
              </label>
            </div>
          </div>
        </PreviewRoot>
      );

    case 'footer':
      return (
        <PreviewRoot enlarged={enlarged}>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-xl border border-t border-slate-200 bg-slate-50 px-2 py-2">
            <Btn variant="danger">삭제</Btn>
            <div className="flex gap-1">
              <Btn>닫기</Btn>
              <Btn variant="primary">저장</Btn>
            </div>
          </div>
        </PreviewRoot>
      );

    default:
      return null;
  }
}

export function InquiryHelpDetailSectionFigure({
  id,
  caption = INQUIRY_HELP_DETAIL_PREVIEW_CAPTION,
}: {
  id: InquiryHelpDetailPreviewId;
  caption?: string;
}) {
  return (
    <InquiryHelpZoomableFigure
      caption={caption}
      contentClassName="p-0 bg-transparent border-0 shadow-none"
      zoomContent={<InquiryHelpDetailSectionPreviewInner id={id} enlarged />}
    >
      <InquiryHelpDetailSectionPreviewInner id={id} />
    </InquiryHelpZoomableFigure>
  );
}
