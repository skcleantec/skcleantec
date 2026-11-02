import { normalizeMessageFieldTokens } from '@shared/telecrmSoomgoFollowupAuto';

/** 문구 속 「{고객명}」 같은 치환코드 — 메뉴마다 실제로 바뀌는 칸·예시가 다름 */
export type CrmMessageFieldsMenu =
  | 'sms'
  | 'script'
  | 'soomgo-macro'
  | 'soomgo-intake'
  | 'soomgo-call'
  | 'soomgo-quote';

export type CrmMessageField = {
  key: string;
  /** 무엇으로 바뀌나요 */
  meaning: string;
  /** 예시 값 */
  sample: string;
};

const FIELD: Record<string, Omit<CrmMessageField, 'key'>> = {
  고객명: { meaning: '접수란의 고객 이름 (비어 있으면 닉네임이나 「고객님」)', sample: '김민지' },
  닉네임: { meaning: '숨고 닉네임 (비어 있으면 고객명)', sample: '민지맘' },
  마케터명: { meaning: '지금 로그인한 상담사 이름', sample: '이상담' },
  연락처: { meaning: '고객 연락처', sample: '010-1234-5678' },
  평수: { meaning: '가격 안내에 넣은 평수 (숫자만)', sample: '24' },
  예상가: { meaning: '가격 안내 합계 금액', sample: '250,000원' },
  견적가: { meaning: '견적보내기 누를 때의 가격 안내 합계', sample: '250,000원' },
  이벤트가: { meaning: '견적가에서 페이백 금액을 뺀 금액', sample: '240,000원' },
  페이백금액: { meaning: '기본 단가 설정의 페이백 금액', sample: '10,000원' },
  발주서링크: { meaning: '이 접수에 연결된 발주서 주소 (발급한 뒤에만)', sample: 'cbiseo.com/o/AB12' },
};

type MenuDef = {
  title: string;
  /** 언제 바뀌나요 — 한 줄 */
  when: string;
  fields: string[];
  /** 메뉴에 맞는 예시 문구 (치환코드 그대로) */
  example: string;
  /** 메뉴별로 바꿔 보여 줄 예시 값 */
  sampleOverride?: Record<string, string>;
  meaningOverride?: Record<string, string>;
};

export const CRM_MESSAGE_FIELD_MENUS: Record<CrmMessageFieldsMenu, MenuDef> = {
  sms: {
    title: '문자 문구',
    when: '「문자 발송」에서 문구를 고를 때 지금 고객 값으로 바뀌어요.',
    fields: ['고객명', '연락처', '평수', '예상가', '발주서링크'],
    example:
      '{고객명}님, 문의 주셔서 감사합니다.\n{평수}평 입주청소 예상 금액은 {예상가}입니다.\n예약은 아래 주소에서 해 주세요 👉 {발주서링크}',
  },
  script: {
    title: '상담 스크립트',
    when: '상담 화면 스크립트 칸에 보일 때 지금 고객 값으로 바뀌어요.',
    fields: ['고객명', '평수', '예상가'],
    example: '{고객명}님, 말씀해 주신 {평수}평 기준으로 기본 청소는 {예상가}부터예요.',
  },
  'soomgo-macro': {
    title: '숨고 메시지 단추',
    when: '「숨고 메시지」에서 단추를 누를 때 지금 고객 값으로 바뀌어요.',
    fields: ['닉네임', '고객명', '마케터명', '평수', '예상가'],
    example:
      '{닉네임}님 안녕하세요, 담당 {마케터명}입니다.\n현장 사진 2~3장 보내주시면 {평수}평 기준으로 더 정확히 안내드릴게요.',
  },
  'soomgo-intake': {
    title: '처리 구분 자동 메시지',
    when: '접수란에서 처리 구분(부재·예약완료 등)을 저장할 때 바뀌어요.',
    fields: ['닉네임', '고객명', '마케터명'],
    example:
      '{닉네임}님, 방금 전화드렸는데 연결이 안 돼서 남겨요.\n편하실 때 이 채팅으로 말씀 주세요. - 담당 {마케터명}',
  },
  'soomgo-call': {
    title: '통화할 때 자동 안내',
    when: '「통화」 단추를 누를 때 숨고로 먼저 나가며 바뀌어요.',
    fields: ['마케터명', '닉네임', '고객명'],
    example: '{닉네임}님, {마케터명}님이 지금 전화 연결을 시도 중입니다. 잠시만 기다려 주세요!',
  },
  'soomgo-quote': {
    title: '견적보내기',
    when: '「견적보내기」를 누를 때 그 순간의 견적 금액으로 바뀌어요.',
    fields: ['닉네임', '고객명', '평수', '견적가', '이벤트가', '페이백금액', '예상가'],
    example:
      '{닉네임}님, {평수}평 입주청소 견적은 {견적가}입니다.\n리뷰 이벤트 참여 시 {페이백금액} 돌려드려서 실제 {이벤트가}예요.',
    meaningOverride: { 예상가: '견적가와 같아요' },
  },
};

export function crmMessageFieldsOf(menu: CrmMessageFieldsMenu): CrmMessageField[] {
  const def = CRM_MESSAGE_FIELD_MENUS[menu];
  return def.fields.map((key) => ({
    key,
    meaning: def.meaningOverride?.[key] ?? FIELD[key]?.meaning ?? '',
    sample: def.sampleOverride?.[key] ?? FIELD[key]?.sample ?? '',
  }));
}

/** 예시 값으로 채움 — menu 가 있으면 그 메뉴에서 바뀌는 칸만 바꾸고 나머지는 그대로 둠 */
export function fillCrmMessageFields(text: string, menu?: CrmMessageFieldsMenu): string {
  const normalized = normalizeMessageFieldTokens(text);
  const allowed = menu ? new Set(CRM_MESSAGE_FIELD_MENUS[menu].fields) : null;
  const sampleOf = (key: string) =>
    (menu ? CRM_MESSAGE_FIELD_MENUS[menu].sampleOverride?.[key] : undefined) ?? FIELD[key]?.sample;
  return normalized.replace(/\{([^{}]+)\}/g, (all, key: string) => {
    if (allowed && !allowed.has(key)) return all;
    return sampleOf(key) ?? all;
  });
}
