import type {
  QuotationEditorOperatingCompanyDto,
  QuotationServiceItemDto,
} from '../../../api/quotations';
import type { TenantCompanyRegistration } from '../../../api/tenantCompanyProfile';

/** 도움말 전용 — 실명·실제 고객 데이터 없음 */

export const QUOTATION_HELP_DEMO = {
  customerName: '이○○',
  customerPhone: '010-****-1234',
  customerEmail: 'demo***@example.com',
  customerAddress: '서울특별시 강남구 ○○로 12',
  memo: '엘리베이터 이용 가능 · 주차 협의',
  validUntil: '2026-09-07',
  quoteNumber: 'Q2608070001',
  createdAt: '2026-08-07T06:00:00.000Z',
  discountAmount: '0',
  emailSubject: '[청소비서] 견적서를 보내 드립니다',
  emailBody:
    '안녕하세요. 요청하신 견적서 PDF를 첨부합니다.\n검토 후 회신 부탁드립니다.',
  footerNotice: '본 견적은 유효기간 내 확정 시 적용됩니다.',
} as const;

export const QUOTATION_HELP_DEMO_CATALOG: QuotationServiceItemDto[] = [
  {
    id: 'demo-q-cat-1',
    name: '입주청소(기본)',
    unitPrice: 350000,
    description: null,
    sortOrder: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-q-cat-2',
    name: '냉장고 청소',
    unitPrice: 30000,
    description: null,
    sortOrder: 2,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const QUOTATION_HELP_DEMO_TENANT_REG: TenantCompanyRegistration = {
  companyName: '청소비서',
  businessRegistrationNo: '123-45-67890',
  representativeName: '홍○○',
  addressLine: '서울특별시 ○○구 ○○로 1',
  phone: '02-****-1234',
  contactEmail: 'contact@example.com',
};

export const QUOTATION_HELP_DEMO_OPERATING_COMPANY: QuotationEditorOperatingCompanyDto = {
  id: 'demo-q-oc-1',
  name: 'cbiseo',
  displayName: '청소비서',
  slug: 'cbiseo',
  isDefault: true,
  companyRegistration: QUOTATION_HELP_DEMO_TENANT_REG,
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    from: '',
    passwordConfigured: true,
    configured: true,
  },
  smtpEffectiveConfigured: true,
};
