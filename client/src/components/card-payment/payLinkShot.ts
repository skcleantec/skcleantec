import type { PublicPayLinkViewData } from './PublicPayLinkView';

const TENANT: PublicPayLinkViewData = {
  state: 'wait',
  sellerName: 'SK클린텍',
  footerName: 'SK클린텍',
  representativeName: '이정무',
  bizNo: '229-24-61773',
  address: '인천 연수구 센트럴로 313, C워크 B동 2219호',
  supportPhone: null,
  statementName: 'SK클린텍',
  amountKrw: 380000,
  supplyKrw: 345455,
  vatKrw: 34545,
  goodsName: '입주청소 서비스',
  serviceDateLabel: '11월 2일 (일)',
  customerMasked: '김*지',
  orderNo: 'C-20261030-0142',
  deadlineLabel: '11월 6일 13:20까지',
  paidAtLabel: '10월 30일 14:32',
  cardLabel: '····1234',
  approvalNo: '30128475',
  cancelledAtLabel: '10월 30일 15:10',
  offTitle: '결제 기한이 지났어요',
};

const SB: PublicPayLinkViewData = {
  ...TENANT,
  sellerName: '서비스브릿지',
  footerName: '(주)서비스브릿지',
  representativeName: '이정무',
  bizNo: '138-87-04035',
  address: '인천광역시 연수구 송도미래로 30, 이동 801호, 엠46(송도동, 스마트밸리지식산업센터)',
  statementName: '서비스브릿지',
  supportPhone: null,
};

export function payLinkShot(who: string | null, state: string | null): PublicPayLinkViewData | null {
  const host = window.location.hostname;
  const allowed = host.includes('staging') || host === 'localhost' || host === '127.0.0.1';
  if (!allowed || !state) return null;
  if (state !== 'wait' && state !== 'done' && state !== 'expired' && state !== 'cancelled') return null;
  const base = who === 'sb' ? SB : TENANT;
  return { ...base, state };
}
