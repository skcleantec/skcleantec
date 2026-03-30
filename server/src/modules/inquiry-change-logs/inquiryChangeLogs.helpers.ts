import type { InquiryChangeLog, Inquiry } from '@prisma/client';

export type ChangeHistoryItemDto = {
  id: string;
  inquiryId: string;
  customerName: string;
  createdAt: string;
  actorName: string | null;
  /** 한 줄 요약 (목록용) */
  summaryLine: string;
  /** 상세 줄들 */
  lines: string[];
};

export function parseLinesJson(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((x) => String(x)).filter(Boolean);
}

export function toChangeHistoryItemDto(
  log: InquiryChangeLog & { inquiry: Pick<Inquiry, 'customerName'> },
  actorName: string | null
): ChangeHistoryItemDto {
  const lineArr = parseLinesJson(log.lines);
  const summaryLine =
    lineArr.length === 0
      ? '(변경 요약 없음)'
      : lineArr.length === 1
        ? lineArr[0]
        : `${lineArr[0]} 외 ${lineArr.length - 1}건`;

  return {
    id: log.id,
    inquiryId: log.inquiryId,
    customerName: log.inquiry.customerName,
    createdAt: log.createdAt.toISOString(),
    actorName,
    summaryLine,
    lines: lineArr,
  };
}
