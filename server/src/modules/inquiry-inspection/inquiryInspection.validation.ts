import type { Prisma } from '@prisma/client';
import {
  basicAnswersComplete,
  emptyBasicAnswers,
  isAreaItemsComplete,
  isItemComplete,
  type InspectionBasicAnswers,
  type InspectionBasicQuestionId,
} from '../../lib/inquiryInspectionTemplate.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

export type InspectionCompletionIssue = {
  code: string;
  message: string;
};

function parseBasicAnswers(raw: unknown): InspectionBasicAnswers {
  const base = emptyBasicAnswers();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const key of ['q1', 'q2', 'q3', 'q4'] as InspectionBasicQuestionId[]) {
    const slot = obj[key];
    if (!slot || typeof slot !== 'object') continue;
    const s = slot as Record<string, unknown>;
    base[key] = {
      leader: typeof s.leader === 'boolean' ? s.leader : null,
      customer: typeof s.customer === 'boolean' ? s.customer : null,
    };
  }
  return base;
}

export function validateInspectionCompletion(row: ChecklistRow): InspectionCompletionIssue[] {
  const issues: InspectionCompletionIssue[] = [];

  const basic = parseBasicAnswers(row.basicAnswersJson);
  if (!basicAnswersComplete(basic)) {
    issues.push({ code: 'basic_incomplete', message: '기본사항 4문항을 팀장·고객 모두 응답해 주세요.' });
  }

  if (!row.areas.length) {
    issues.push({ code: 'no_areas', message: '검수 구역이 없습니다.' });
  }

  for (const area of row.areas) {
    if (area.notApplicable) {
      continue;
    }

    const itemStats = area.items.map((item) => ({
      notApplicable: item.notApplicable,
      naReason: item.naReason,
      beforeCount: item.photos.filter((p) => p.phase === 'BEFORE').length,
      afterCount: item.photos.filter((p) => p.phase === 'AFTER').length,
    }));

    if (!area.items.length) {
      issues.push({
        code: 'area_no_items',
        message: `「${area.label}」 구역: 세부 항목이 없습니다. 항목을 추가해 주세요.`,
      });
      continue;
    }

    if (!isAreaItemsComplete(itemStats)) {
      for (const item of area.items) {
        const beforeCount = item.photos.filter((p) => p.phase === 'BEFORE').length;
        const afterCount = item.photos.filter((p) => p.phase === 'AFTER').length;
        if (!isItemComplete({ notApplicable: item.notApplicable, naReason: item.naReason, beforeCount, afterCount })) {
          issues.push({
            code: 'item_incomplete',
            message: `「${area.label} › ${item.label}」: 청소 전·후 사진 또는 해당없음 처리가 필요합니다.`,
          });
        }
      }
    }
  }

  const email = row.customerEmail?.trim() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({ code: 'email_invalid', message: '완료본 수신 이메일을 올바르게 입력해 주세요.' });
  }

  if (!row.consentPersonalInfo) {
    issues.push({ code: 'consent_f1', message: '개인정보 수집·이용 동의가 필요합니다.' });
  }
  if (!row.consentThirdParty) {
    issues.push({ code: 'consent_f2', message: '개인정보 제3자 제공 동의가 필요합니다.' });
  }
  if (!row.consentScopeConfirm) {
    issues.push({ code: 'consent_f3', message: '현장 검수 및 청소 범위 확인 동의가 필요합니다.' });
  }
  if (!row.consentLeaderLiability) {
    issues.push({ code: 'consent_f4_leader', message: '팀장 책임 확인 체크가 필요합니다.' });
  }
  if (!row.consentCustomerConfirm) {
    issues.push({ code: 'consent_f4_customer', message: '고객 확인 체크가 필요합니다.' });
  }
  if (!row.consentEmailDelivery) {
    issues.push({ code: 'consent_email', message: '완료본 이메일 수신 동의가 필요합니다.' });
  }

  if (!row.signatureSecureUrl?.trim() || !row.signaturePublicId?.trim()) {
    issues.push({ code: 'signature_missing', message: '고객 서명이 필요합니다.' });
  }

  return issues;
}

export { parseBasicAnswers };
