/** 도움말 전용 — 실제 고객·업체 데이터 없음 (cbiseo 데모) */

export const INQUIRY_HELP_DEMO = {
  inquiryNumber: 'CB2608010001',
  inquiryNumber2: 'CB2608010002',
  customerName: '이○○',
  customerName2: '박○○',
  phone: '010-****-1234',
  addressShort: '서울 강남구',
  marketer: '마케터A',
  teamLeader: '홍팀장',
  partnerName: '클린파트너',
  operatingCompany: { id: 'demo-oc', name: '프리미엄', slug: 'premium', isActive: true, badgeColorKey: 'violet' as const },
  leadPlatform: 'cbiseo',
} as const;

export const INQUIRY_HELP_DEMO_SHARE_SOURCE = {
  id: 'demo-share-1',
  role: 'SOURCE' as const,
  partnerTenantId: 'demo-partner',
  partnerName: INQUIRY_HELP_DEMO.partnerName,
  partnerSlug: 'clean-partner',
  transferFee: 50000,
  sourceInquiryNumberSnapshot: null,
  sharedAt: '2026-08-01T10:00:00.000Z',
  syncStatus: 'ACTIVE' as const,
  viaMarketplace: false,
};

export const INQUIRY_HELP_DEMO_DB_LISTING = {
  listingId: 'demo-listing',
  status: 'OPEN' as const,
};

export const INQUIRY_HELP_DEMO_INSPECTION = {
  status: 'IN_PROGRESS' as const,
  completedAt: null,
  emailSentAt: null,
  hasPdf: false,
  beforeDone: 2,
  beforeTotal: 4,
  afterDone: 0,
  afterTotal: 4,
  itemsComplete: 1,
  itemsTotal: 3,
};
