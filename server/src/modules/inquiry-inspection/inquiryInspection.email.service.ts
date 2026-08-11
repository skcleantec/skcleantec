import {
  formatSmtpSendError,
  sendMailWithTransport,
} from '../../lib/tenantSmtp.service.js';
import {
  isPlatformCustomerMailConfigured,
  resolvePlatformCustomerMailTransport,
} from '../../lib/outboundEmailRouter.js';
import {
  buildInspectionCompletionEmailContent,
} from '../platform-email-templates/platformCustomerEmailRender.service.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

const GMAIL_SAFE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function assertCustomerEmail(row: ChecklistRow): string {
  const email = row.customerEmail?.trim() ?? '';
  if (!email) {
    throw Object.assign(new Error('no_customer_email'), {
      code: 'no_customer_email' as const,
      message: '완료본 수신 이메일이 비어 있습니다. 현장검수 화면에서 고객 이메일을 입력·저장한 뒤 다시 시도해 주세요.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('invalid_customer_email'), {
      code: 'invalid_customer_email' as const,
      message: '완료본 수신 이메일 형식이 올바르지 않습니다. 현장검수에서 이메일을 수정해 주세요.',
    });
  }
  return email;
}

export async function sendInspectionCompletionEmail(params: {
  tenantId: string;
  operatingCompanyId?: string | null;
  row: ChecklistRow;
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  };
  /** 제목·발신 표시에 쓰는 브랜드/업체명 (브랜드 접수면 해당 브랜드명) */
  tenantDisplayName: string;
  pdfBuffer: Buffer | null;
  pdfUrl: string | null;
  customerViewUrl?: string | null;
}): Promise<boolean> {
  const email = assertCustomerEmail(params.row);

  if (!(await isPlatformCustomerMailConfigured('INSPECTION_COMPLETION'))) {
    throw Object.assign(new Error('platform_smtp_not_configured'), {
      code: 'platform_smtp_not_configured' as const,
      message:
        '플랫폼 고객 발송 SMTP(noreply)가 설정되지 않았습니다. 플랫폼 설정 → SMTP 프로필을 확인해 주세요.',
    });
  }

  const transport = await resolvePlatformCustomerMailTransport({
    purpose: 'INSPECTION_COMPLETION',
    brandDisplayName: params.tenantDisplayName,
  });
  if (!transport) {
    throw Object.assign(new Error('platform_smtp_not_configured'), {
      code: 'platform_smtp_not_configured' as const,
      message:
        '플랫폼 고객 발송 SMTP(noreply)가 설정되지 않았습니다. 플랫폼 설정 → SMTP 프로필을 확인해 주세요.',
    });
  }

  const contentOpts = {
    customerViewUrl: params.customerViewUrl,
    pdfUrl: params.pdfUrl,
  };
  const { subject, plain: text, html } = await buildInspectionCompletionEmailContent({
    tenantDisplayName: params.tenantDisplayName,
    row: params.row,
    inquiry: params.inquiry,
    opts: contentOpts,
  }).then((r) => ({ subject: r.subject, plain: r.text, html: r.html }));

  const attachment =
    params.pdfBuffer && params.pdfBuffer.length > 0 && params.pdfBuffer.length <= GMAIL_SAFE_ATTACHMENT_BYTES
      ? {
          filename: `현장검수_${params.inquiry.customerName.slice(0, 20)}.pdf`,
          content: params.pdfBuffer,
          contentType: 'application/pdf' as const,
        }
      : undefined;

  const mailInput = {
    to: email,
    subject,
    html,
    text: text,
  };

  const send = async (withAttachment: boolean) => {
    await sendMailWithTransport(
      transport,
      withAttachment && attachment ? { ...mailInput, attachments: [attachment] } : mailInput,
    );
  };

  if (attachment) {
    try {
      await send(true);
      return true;
    } catch (e) {
      console.warn(
        '[inspection-email] PDF 첨부 발송 실패 — 링크만 포함해 재시도',
        formatSmtpSendError(e),
      );
    }
  } else if (params.pdfBuffer && params.pdfBuffer.length > GMAIL_SAFE_ATTACHMENT_BYTES) {
    console.warn(
      '[inspection-email] PDF가 커서 첨부 생략',
      params.pdfBuffer.length,
      'bytes — 다운로드 링크만 발송',
    );
  }

  await send(false);
  return true;
}
