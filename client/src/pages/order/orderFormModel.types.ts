import type { MoveInTiming } from '@shared/orderFormMoveInTiming';
import type { InternalCustomerTone } from '../../constants/internalCustomerTone';
import type { OperatingCompanyCancellationPolicy } from '@shared/operatingCompanyCancellationPolicy';
import type { OrderFormPublicTemplate } from '../../api/orderform';
import type { CrmOrderIssueSeed } from '../../components/orderform/OrderIssueInlinePanel';

export type OrderFormFields = {
  customerName: string;
  customerPhone: string;
  customerPhoneSecondary: string;
  customerEmail: string;
  address: string;
  addressDetail: string;
  propertyType: string;
  areaBasis: string;
  areaPyeong: string;
  exclusiveAreaSqm: string;
  preferredDate: string;
  preferredTime: string;
  preferredTimeDetail: string;
  roomCount: string;
  balconyCount: string;
  bathroomCount: string;
  kitchenCount: string;
  buildingType: string;
  moveInTiming: MoveInTiming | '';
  moveInDate: string;
  moveInDateUndecided: boolean;
  isOneRoom: boolean;
  specialNotes: string;
};

export const EMPTY_ORDER_FORM_FIELDS: OrderFormFields = {
  customerName: '',
  customerPhone: '',
  customerPhoneSecondary: '',
  customerEmail: '',
  address: '',
  addressDetail: '',
  propertyType: '',
  areaBasis: '',
  areaPyeong: '',
  exclusiveAreaSqm: '',
  preferredDate: '',
  preferredTime: '',
  preferredTimeDetail: '',
  roomCount: '',
  balconyCount: '',
  bathroomCount: '',
  kitchenCount: '',
  buildingType: '',
  moveInTiming: '',
  moveInDate: '',
  moveInDateUndecided: false,
  isOneRoom: false,
  specialNotes: '',
};

export type OrderFormLoadedOrder = {
  customerName: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  optionNote: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  areaPyeong?: number | null;
  areaBasis?: string | null;
  formConfig?: {
    formTitle?: string;
    priceLabel?: string | null;
    reviewEventText?: string | null;
    footerNotice1?: string | null;
    footerNotice2?: string | null;
    infoContent?: string | null;
    infoLinkText?: string | null;
    submitSuccessTitle?: string | null;
    submitSuccessBody?: string | null;
    timeSlotAckTitle?: string | null;
    timeSlotAckBody?: string | null;
    timeSlotAckConsentHint?: string | null;
    serviceDateAckTitle?: string | null;
    serviceDateAckBody?: string | null;
    serviceDateAckConsentHint?: string | null;
    guidePolicy?: OperatingCompanyCancellationPolicy;
    timeSlotLabels?: Record<'오전' | '오후' | '사이청소', string>;
    timeSlotLabelsJson?: Record<string, string> | null;
  };
  template?: OrderFormPublicTemplate | null;
  prefillAnswers?: Record<string, unknown> | null;
};

export type SubmitValidationIssue = { message: string; fieldId?: string };
export type SubmitErrorModalState = {
  messages: string[];
  fieldId?: string;
} | null;

/** 마케터 선입력 편집/발급 모드 — 지정 시 고객 폼과 동일 화면을 재사용 */
export interface OrderFormEditorContext {
  authToken: string;
  onClose?: () => void;
  orderFormId?: string;
  create?: {
    templateId?: string;
    pendingInquiryId?: string;
    internalCustomerTone?: InternalCustomerTone;
    leadSource?: string;
    operatingCompanyId?: string;
    collaborationMarketerId?: string | null;
    onCreated: (order: import('../../api/orderform').OrderForm) => void;
    crmSeed?: CrmOrderIssueSeed;
  };
  inline?: boolean;
}

export const PROPERTY_TYPE_OPTIONS = [
  { value: '아파트', label: '아파트' },
  { value: '오피스텔', label: '오피스텔' },
  { value: '빌라(연립)', label: '빌라(연립)' },
  { value: '상가', label: '상가' },
  { value: '기타', label: '기타' },
] as const;

export const AREA_BASIS_COST_WARNING =
  '잘못된 평수기입으로 인한 서비스비용변동은 책임지지 않습니다.';

export const ORDER_FORM_PREFERRED_DATE_PENALTY_NOTICE =
  '희망 청소일을 잘못 적으면 위약금·취소 비용이 생길 수 있으며, 그 책임은 업체에 있지 않습니다. 반드시 안내사항(주의사항)을 읽어 주세요.';
