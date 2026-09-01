import type { AlimtalkTemplateCode } from './alimtalkPolicy.js';

export type AlimtalkTemplateHelp = {
  where: string;
  when: string;
  note?: string;
};

export const ALIMTALK_TEMPLATE_HELP: Record<AlimtalkTemplateCode, AlimtalkTemplateHelp> = {
  CBISEO_CUST_ORDER_LINK: {
    where: '서비스접수 → 발주서 발급·발주서 목록 화면의 「알림톡 발송」 버튼',
    when: '수동 — 마케터가 고객 연락처를 확인한 뒤 버튼을 눌렀을 때 1건 발송',
  },
  CBISEO_CUST_ORDER_DONE: {
    where: '별도 버튼 없음 (고객 발주서 제출 화면)',
    when: '자동 — 고객이 발주서를 제출·완료한 직후',
  },
  CBISEO_CUST_SCHEDULE_D2: {
    where: '별도 버튼 없음 (스케줄·접수 상태 연동)',
    when:
      '자동 — 브랜드 위약일(무위약 기준일)이 설정된 접수의 **무위약 마감일 당일** 매일 낮 12시(KST), 접수당 1회',
    note: '위약 없이 바꿀 수 있는 마지막 날은 영업브랜드 → 위약금에서 정합니다. 알림톡 화면의 「브랜드 위약금 설정 바로가기」로 이동합니다. 기준일이 없으면 보내지 않습니다.',
  },
};

export function formatAlimtalkTemplateHelpText(code: AlimtalkTemplateCode): string {
  const h = ALIMTALK_TEMPLATE_HELP[code];
  const lines = [`발송 위치: ${h.where}`, `발송 시점: ${h.when}`];
  if (h.note) lines.push(h.note);
  lines.push('OFF면 수동·자동 발송 모두 건너뜁니다.');
  return lines.join('\n');
}
