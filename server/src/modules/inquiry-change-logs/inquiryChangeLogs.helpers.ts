import type { InquiryChangeLog, Inquiry } from '@prisma/client';

/** 변경 유형 — 클라이언트 색·아이콘·필터에 사용 */
export type ChangeLogCategory = 'date' | 'cost' | 'extra' | 'team' | 'status' | 'etc';

export type ChangeHistoryItemDto = {
  id: string;
  inquiryId: string | null;
  customerName: string;
  createdAt: string;
  actorName: string | null;
  /** 한 줄 요약 (목록용) */
  summaryLine: string;
  /** 상세 줄들 */
  lines: string[];
  /** 이 이력에 포함된 변경 유형들 (중복 제거) */
  categories: ChangeLogCategory[];
};

export function parseLinesJson(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((x) => String(x)).filter(Boolean);
}

/** 변경 요약 한 줄을 유형으로 분류 (한국어 키워드 기반 휴리스틱) */
export function categorizeChangeLine(line: string): ChangeLogCategory {
  const t = line ?? '';
  if (/추가\s?청소|추가\s?비용|추가\s?금액|추가\s?항목|추가결재/.test(t)) return 'extra';
  if (/희망일|청소일|미팅|이사일|시간대|사이청소|일정/.test(t)) return 'date';
  if (/팀장|팀원|배정|담당/.test(t)) return 'team';
  if (/총액|예약금|잔금|수수료|금액|비용/.test(t)) return 'cost';
  if (/상태|취소|보류|완료|삭제/.test(t)) return 'status';
  return 'etc';
}

/** 여러 줄에서 등장한 유형을 정의된 우선순위 순으로 중복 제거해 반환 */
export function categorizeLines(lines: string[]): ChangeLogCategory[] {
  const order: ChangeLogCategory[] = ['date', 'cost', 'extra', 'team', 'status', 'etc'];
  const present = new Set<ChangeLogCategory>();
  for (const line of lines) present.add(categorizeChangeLine(line));
  return order.filter((c) => present.has(c));
}

export function toChangeHistoryItemDto(
  log: InquiryChangeLog & { inquiry: Pick<Inquiry, 'customerName'> | null },
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
    customerName: log.customerName || log.inquiry?.customerName || '(삭제된 접수)',
    createdAt: log.createdAt.toISOString(),
    actorName,
    summaryLine,
    lines: lineArr,
    categories: categorizeLines(lineArr),
  };
}
