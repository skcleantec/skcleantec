import type { ReactNode } from 'react';
import {
  QuotationHelpAddLineButton,
  QuotationHelpBrandSelect,
  QuotationHelpCustomerFieldMock,
  QuotationHelpDocumentTypeSelect,
  QuotationHelpEmailResendButton,
  QuotationHelpEmailSendButton,
  QuotationHelpFinalizeButton,
  QuotationHelpInquiryCreateButton,
  QuotationHelpInquiryLinkBanner,
  QuotationHelpNewQuotationLink,
  QuotationHelpPdfDownloadButton,
  QuotationHelpPdfPreviewButton,
  QuotationHelpSaveButton,
  QuotationHelpStatusBadge,
} from './QuotationHelpUiParts';

export type QuotationHelpActionRow = {
  sample: ReactNode;
  meaning: string;
  when?: string;
};

/** ① 견적서 작성 */
export const QUOTATION_CREATE_ACTIONS: readonly QuotationHelpActionRow[] = [
  {
    sample: <QuotationHelpNewQuotationLink />,
    meaning: '견적 목록에서 새 문서를 시작합니다.',
    when: '견적 목록 우측',
  },
  {
    sample: <QuotationHelpBrandSelect />,
    meaning: 'PDF·이메일에 표시될 공급자(영업 브랜드)를 고릅니다. SMTP·직인도 브랜드별로 적용됩니다.',
    when: 'A4 양식 상단',
  },
  {
    sample: (
      <>
        <QuotationHelpCustomerFieldMock label="성함(필수)" />
        <QuotationHelpCustomerFieldMock label="연락처" />
        <QuotationHelpCustomerFieldMock label="이메일" />
      </>
    ),
    meaning: '「공급받는자」 칸에 고객 정보를 입력합니다. 이메일은 발송 시 기본값으로 쓰입니다.',
    when: 'A4 양식 본문',
  },
  {
    sample: <QuotationHelpAddLineButton />,
    meaning: '품목표에서 행을 추가하고 품명·단가·수량을 입력합니다. 견적 설정의 품목 카탈로그에서 불러올 수 있습니다.',
    when: '품목표 하단 +',
  },
  {
    sample: (
      <>
        <QuotationHelpSaveButton />
        <QuotationHelpFinalizeButton />
      </>
    ),
    meaning:
      '「저장」으로 견적 번호가 생깁니다. 내용을 확정했으면 「확정 저장」(상태: 확정). PDF·이메일은 저장 후에만 가능합니다.',
    when: '화면 하단 고정 바',
  },
];

/** ② 고객(접수) 정보 연결 */
export const QUOTATION_LINK_ACTIONS: readonly QuotationHelpActionRow[] = [
  {
    sample: <QuotationHelpInquiryCreateButton />,
    meaning:
      '접수 상세 「견적서」 섹션에서 누르면, 해당 접수와 연결된 채 견적 편집 화면이 열립니다. 고객명·연락처·주소가 미리 채워집니다.',
    when: '접수 상세 · 견적서',
  },
  {
    sample: <QuotationHelpInquiryLinkBanner />,
    meaning: '연결된 접수 번호·고객명이 상단에 표시됩니다. 저장 시 같은 접수에 견적이 묶입니다.',
    when: '편집 화면 상단',
  },
  {
    sample: <QuotationHelpSaveButton />,
    meaning: '저장하면 견적서가 접수에 연결됩니다. 접수 상세에서 연결된 견적 목록으로 다시 열 수 있습니다.',
  },
  {
    sample: <QuotationHelpNewQuotationLink>견적 목록</QuotationHelpNewQuotationLink>,
    meaning:
      '접수 없이 만들면 고객 정보만 수동 입력합니다. 나중에 접수와 연결하려면 접수 상세에서 「+ 견적서 만들기」로 새로 만드는 것이 편합니다.',
  },
];

/** ③ 영수증 */
export const QUOTATION_RECEIPT_ACTIONS: readonly QuotationHelpActionRow[] = [
  {
    sample: <QuotationHelpDocumentTypeSelect value="RECEIPT" />,
    meaning: '「문서 유형」을 영수증으로 바꾸면 제목·마무리 문구·하단 안내가 영수증 형식으로 바뀝니다.',
    when: 'A4 양식 상단',
  },
  {
    sample: <QuotationHelpDocumentTypeSelect value="QUOTATION" />,
    meaning: '견적서와 동일하게 품목·금액을 입력합니다. 영수증은 유효기간(견적 유효일) 입력란이 없습니다.',
  },
  {
    sample: (
      <>
        <QuotationHelpSaveButton />
        <QuotationHelpFinalizeButton />
      </>
    ),
    meaning: '저장·확정 후 PDF·이메일 발송 절차는 견적서와 같습니다.',
    when: '하단 고정 바',
  },
  {
    sample: (
      <>
        <QuotationHelpPdfPreviewButton />
        <QuotationHelpPdfDownloadButton />
      </>
    ),
    meaning: '영수증 PDF를 미리보기·다운로드할 수 있습니다. 파일명에 견적 번호가 붙습니다.',
    when: '저장 후',
  },
];

/** ④ 고객 발송 */
export const QUOTATION_SEND_ACTIONS: readonly QuotationHelpActionRow[] = [
  {
    sample: <QuotationHelpSaveButton />,
    meaning: '1단계 — 먼저 저장해야 PDF·이메일 버튼이 활성화됩니다.',
  },
  {
    sample: (
      <>
        <QuotationHelpPdfPreviewButton />
        <QuotationHelpPdfDownloadButton />
      </>
    ),
    meaning: '2단계 — 발송 전 PDF 내용을 확인하거나 파일로 저장합니다.',
    when: '하단 고정 바',
  },
  {
    sample: <QuotationHelpEmailSendButton />,
    meaning:
      '3단계 — 「이메일 발송」 섹션에서 수신·제목·본문 확인 후 PDF를 첨부해 보냅니다. SMTP(브랜드별) 설정이 필요합니다.',
    when: '저장 후 · 편집 화면 하단',
  },
  {
    sample: (
      <>
        <QuotationHelpStatusBadge status="SENT" />
        <QuotationHelpEmailResendButton />
      </>
    ),
    meaning: '발송 성공 시 상태가 「발송됨」으로 바뀌고, 「재발송」·발송 이력에서 확인할 수 있습니다.',
  },
  {
    sample: (
      <>
        <QuotationHelpStatusBadge status="DRAFT" />
        <span className="text-fluid-2xs text-slate-400 px-1">→</span>
        <QuotationHelpStatusBadge status="FINALIZED" />
        <span className="text-fluid-2xs text-slate-400 px-1">→</span>
        <QuotationHelpStatusBadge status="SENT" />
      </>
    ),
    meaning: '작성 중 → (확정 저장) 확정 → (PDF 첨부 발송) 발송됨 순서로 상태가 바뀝니다.',
  },
];
