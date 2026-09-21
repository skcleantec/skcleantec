/**
 * 업종별 고객 안내 기본 문구.
 * 위약 % 숫자는 넣지 않는다 — {{cancellationPolicy}} 가 브랜드 설정을 따른다.
 */
import { GUIDE_PLACEHOLDER_CANCELLATION_POLICY } from './orderFormGuidePlaceholders';
import {
  isOrderFormIndustryPackId,
  type OrderFormIndustryPackId,
} from './orderFormIndustryPacks';

export type OrderFormGuideSection = { title: string; items: string[] };

const CANCEL: OrderFormGuideSection = {
  title: '취소·변경 안내',
  items: [
    GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
    '일정이 바뀌면 바로 예약 번호로 연락해 주세요. 늦을수록 위약·출장비가 생길 수 있습니다.',
  ],
};

const PRIVACY_BASE = (purpose: string, fields: string): OrderFormGuideSection => ({
  title: '개인정보 수집 안내',
  items: [
    `발주서 작성 시 수집되는 정보: ${fields}`,
    `수집 목적: ${purpose}`,
    '보유 기간: 서비스 완료 및 사후 처리 종료 시까지 보유 후 파기합니다. 관계 법령에 따라 보존이 필요한 경우 해당 법령에 따릅니다.',
    '개인정보 열람·정정·삭제·처리 정지 요청은 예약 번호로 연락 주시면 안내해 드리겠습니다.',
  ],
});

const PAY_COMMON: string[] = [
  '잔금은 서비스 완료 후 현장에서 즉시 결제해 주세요. 결제 완료 후 팀원이 철수합니다.',
  '주차 비용이 발생하면 고객님 부담입니다.',
  '현장에서 추가 작업이 필요하면 금액·범위를 먼저 안내하고, 동의하신 뒤에만 진행합니다. 동의 없는 추가금은 청구하지 않습니다.',
];

export const ORDER_FORM_INDUSTRY_GUIDE_DEFAULTS: Record<OrderFormIndustryPackId, OrderFormGuideSection[]> = {
  move_in: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '서비스 전날 담당 팀장이 연락드리니 꼭 확인해 주세요.',
        '이사·인테리어·가전 설치와 시간이 겹쳐 시작이 늦어지면 대기료가 생기거나 당일 작업이 어려울 수 있습니다.',
        '시작 시각은 교통에 따라 30분 안팎 달라질 수 있습니다.',
        '견적 때와 평수·방 구조가 다르면 현장에서 금액을 조율합니다.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '전기·수도가 되는 빈집을 권합니다. 짐이 많으면 옮기며 청소하지 않습니다.',
        '인테리어 폐기물·보양지는 시공 업체에서 치워 주세요. 분진이 심한 현장은 추가 비용이 날 수 있습니다.',
        '테라스·증축 등 외부는 기본 범위가 아닙니다.',
        '귀중품은 미리 말씀해 주세요. 안내 없이 두신 물건은 폐기될 수 있습니다.',
      ],
    },
    {
      title: '추가요금이 생길 수 있는 경우',
      items: [
        '견적과 다른 평수·복층·확장 베란다',
        '스티커·시트지·니코틴·백화 등 특수 약품이 필요한 오염',
        '시스템 에어컨·냉장고·오븐 내부, 붙박이장 내부(별도)',
        '검수는 현장에서 해 주세요. 모자란 부분은 바로 보완합니다.',
      ],
    },
    {
      title: '결제·기타',
      items: [
        ...PAY_COMMON,
        '청소 쓰레기는 한곳에 모아 드리며, 종량제·분리수거는 고객님께서 해 주세요.',
      ],
    },
    PRIVACY_BASE(
      '입주·이사 청소 예약, 현장 배정, 팀장 연락, 서비스 제공 및 A/S',
      '성함, 연락처, 주소, 평수, 희망일시, 방·화장실 등 구조, 특이사항',
    ),
  ],
  aircon: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '방문 전날 또는 당일 기사님이 연락드립니다.',
        '견적에 적은 기종·대수와 현장이 다르면 금액을 다시 안내합니다. 동의 후에만 추가 작업을 합니다.',
        '전기·수도·배수가 되어야 합니다. 화장실·배수구를 쓸 수 없으면 작업이 어렵습니다.',
        '제품 주위에 작업할 공간이 있어야 합니다. 옮길 수 없는 가구가 막으면 출장비만 발생할 수 있습니다.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '벽걸이·스탠드·천장형 등 기종과 대수를 정확히 적어 주세요. 실외기는 기본에 포함되지 않을 수 있습니다.',
        '층고가 높거나 사다리가 필요한 현장은 미리 말씀해 주세요.',
        '고장·파손·누수 제품은 분해 청소가 제한될 수 있습니다.',
        '완전분해와 필터·커버만 세척은 범위가 다릅니다. 상담하신 범위를 발주서에 적어 주세요.',
      ],
    },
    {
      title: '추가요금·출장비가 생길 수 있는 경우',
      items: [
        '당일·방문 직전 취소, 또는 방문 후 작업이 불가한 경우 출장비가 발생할 수 있습니다.',
        '견적에 없는 실외기·추가 대수·특수 기종',
        '야간 작업, 주차 불가(유료 주차는 고객 부담)',
        '사전 동의 없이 추가금을 받지 않습니다.',
      ],
    },
    { title: '결제·기타', items: PAY_COMMON },
    PRIVACY_BASE(
      '에어컨 청소 예약, 기사 배정, 서비스 제공 및 A/S',
      '성함, 연락처, 주소, 희망일시, 기종·대수, 특이사항',
    ),
  ],
  appliance: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '방문 전 기사님이 연락드립니다. 제품 주변 공간과 물·전기를 확인해 주세요.',
        '세탁기·냉장고·후드 등 제품마다 분해 범위가 다릅니다. 상담하신 제품을 빠짐없이 적어 주세요.',
        '작업이 어려운 현장(배수 불가, 문 개방 부족, 공간 부족)은 출장비만 발생할 수 있습니다.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '냉장고는 문이 충분히 열리고, 안 음식은 미리 치워 주세요.',
        '세탁기·건조기 2단 설치는 추가 작업이 필요할 수 있습니다.',
        '후드 내부는 감전 위험이 있어 필터·겉면만 하는 경우가 많습니다. 내부 분해는 별도입니다.',
        '노후·파손 제품은 분해가 제한될 수 있습니다.',
      ],
    },
    {
      title: '추가요금이 생길 수 있는 경우',
      items: [
        '견적에 없는 제품·대수',
        '당일·방문 후 취소·작업 불가 시 출장비',
        '유료 주차, 야간 작업',
        '사전 동의 후에만 추가 작업을 합니다.',
      ],
    },
    { title: '결제·기타', items: PAY_COMMON },
    PRIVACY_BASE(
      '가전 청소 예약, 기사 배정, 서비스 제공 및 A/S',
      '성함, 연락처, 주소, 희망일시, 제품 종류, 특이사항',
    ),
  ],
  grout: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '줄눈·실리콘 상태는 사진과 현장이 다를 수 있습니다. 당일 범위를 함께 확인한 뒤 진행합니다.',
        '시공 후 마르는 시간(양생) 동안 물기·밟음을 피해 주세요. 안내는 현장 기준으로 드립니다.',
        '환기가 되는 공간을 준비해 주세요.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '타일·줄눈 색은 완전히 같지 않을 수 있습니다.',
        '오래된 실리콘 곰팡이는 약품만으로 100% 제거가 어려울 수 있습니다.',
        '파손된 타일은 교체가 아닙니다. 줄눈 작업 중 약한 타일이 더 상할 수 있어 미리 말씀해 주세요.',
      ],
    },
    {
      title: '추가요금이 생길 수 있는 경우',
      items: [
        '견적보다 넓은 면적, 욕실·주방 추가',
        '제거 후 재시공이 필요한 심한 오염·이중 줄눈',
        '사전 동의 후에만 추가 작업을 합니다.',
      ],
    },
    { title: '결제·기타', items: PAY_COMMON },
    PRIVACY_BASE(
      '줄눈 시공 예약, 현장 배정, 서비스 제공 및 A/S',
      '성함, 연락처, 주소, 희망일시, 시공 위치, 특이사항',
    ),
  ],
  moving: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '출발지·도착지 주소와 이사 시간을 정확히 적어 주세요.',
        '이사 차량·엘리베이터와 청소가 겹치면 대기료가 생기거나 순서를 바꿔야 할 수 있습니다.',
        '짐이 있는 집은 옮기며 청소하지 않습니다. 비운 뒤에 하는 것을 권합니다.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '양쪽 집 출입·주차·엘리베이터 사용을 미리 확인해 주세요.',
        '귀중품은 미리 챙기세요.',
        '견적 평수·방 구조와 현장이 다르면 금액을 조율합니다.',
      ],
    },
    {
      title: '추가요금이 생길 수 있는 경우',
      items: [
        '이사 지연으로 팀이 기다린 시간(대기료)',
        '견적과 다른 평수·짐 상태',
        '주차비, 특수 오염',
        '사전 동의 후에만 추가 작업을 합니다.',
      ],
    },
    { title: '결제·기타', items: PAY_COMMON },
    PRIVACY_BASE(
      '이사 청소 예약, 현장 배정, 서비스 제공 및 A/S',
      '성함, 연락처, 출발·도착 주소, 희망일시, 평수, 특이사항',
    ),
  ],
  pest: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '아이·반려동물·호흡기 질환자는 안내한 시간 동안 외출하거나 환기해 주세요.',
        '약제 알레르기·임산부가 있으면 반드시 미리 알려 주세요.',
        '시공 후 출입·환기 시간은 현장 약제에 따라 안내드립니다.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '싱크대·배수구 주변과 가구 뒤는 손이 닿게 치워 주세요.',
        '효과는 집 구조·재유입에 따라 다릅니다. 한 번에 끝나지 않을 수 있습니다.',
        '식품·식기는 덮거나 치워 주세요.',
      ],
    },
    {
      title: '추가요금이 생길 수 있는 경우',
      items: [
        '견적 면적보다 넓은 공간, 다세대·상가 추가',
        '천장·바닥 속 등 특수 시공',
        '당일 출입이 어려워 재방문하는 경우',
        '사전 동의 후에만 추가 작업을 합니다.',
      ],
    },
    { title: '결제·기타', items: PAY_COMMON },
    PRIVACY_BASE(
      '방역 예약, 현장 배정, 서비스 제공 및 재방문 안내',
      '성함, 연락처, 주소, 희망일시, 면적, 특이사항',
    ),
  ],
  office: [
    CANCEL,
    {
      title: '서비스 진행 안내',
      items: [
        '근무 시간·출입 보안을 미리 알려 주세요. 야간·주말은 별도 협의입니다.',
        '문서·전자기기는 치우거나 덮어 주세요. 함부로 옮기지 않습니다.',
        '시작 전 청소 범위(회의실·화장실·탕비실 등)를 함께 확인합니다.',
      ],
    },
    {
      title: '현장 준비·주의',
      items: [
        '출입 카드·비밀번호·주차 안내를 방문 전에 전달해 주세요.',
        '기밀 서류는 잠가 두세요.',
        '폐기할 문서와 일반 쓰레기를 구분해 두시면 좋습니다.',
      ],
    },
    {
      title: '추가요금이 생길 수 있는 경우',
      items: [
        '견적 면적·층수와 다른 현장',
        '야간·주말·공휴일 할증',
        '카펫 얼룩·특수 오염, 주차비',
        '사전 동의 후에만 추가 작업을 합니다.',
      ],
    },
    { title: '결제·기타', items: PAY_COMMON },
    PRIVACY_BASE(
      '사무실 청소 예약, 현장 배정, 서비스 제공 및 A/S',
      '성함, 연락처, 주소, 희망일시, 면적, 특이사항',
    ),
  ],
};

export function inferOrderFormIndustryPackId(opts: {
  industryPackId?: string | null;
  isDefault?: boolean;
  title?: string | null;
}): OrderFormIndustryPackId | null {
  const raw = opts.industryPackId?.trim();
  if (raw && isOrderFormIndustryPackId(raw)) return raw;
  if (opts.isDefault) return 'move_in';
  const t = (opts.title ?? '').replace(/\s/g, '');
  if (t.includes('에어컨')) return 'aircon';
  if (t.includes('가전') || t.includes('매트리스') || t.includes('후드') || t.includes('세탁기')) return 'appliance';
  if (t.includes('줄눈')) return 'grout';
  if (t.includes('방역') || t.includes('해충')) return 'pest';
  if (t.includes('사무실') || t.includes('오피스')) return 'office';
  if (t.includes('이사') && !t.includes('입주')) return 'moving';
  if (t.includes('입주')) return 'move_in';
  return null;
}

export function defaultGuideSectionsForPack(packId: OrderFormIndustryPackId | null | undefined): OrderFormGuideSection[] {
  if (!packId) return ORDER_FORM_INDUSTRY_GUIDE_DEFAULTS.move_in;
  return ORDER_FORM_INDUSTRY_GUIDE_DEFAULTS[packId] ?? ORDER_FORM_INDUSTRY_GUIDE_DEFAULTS.move_in;
}

export function cloneGuideSections(sections: OrderFormGuideSection[]): OrderFormGuideSection[] {
  return sections.map((s) => ({ title: s.title, items: [...s.items] }));
}
