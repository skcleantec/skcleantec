import type { Dispatch, SetStateAction } from 'react';
import type { OrderFormPublicTemplateField } from '../../../api/orderform';
import type { ProfessionalSpecialtyOptionDto } from '../../../api/orderform';
import type { ProfessionalOptionSelection } from '../../../constants/professionalSpecialtyOptions';
import type { OrderFormFields, OrderFormLoadedOrder } from '../../../pages/order/orderFormModel.types';
import type { OrderFormCustomerStep, OrderFormCustomerStepId } from './orderFormCustomerSteps';

export type CustomerWizardShared = {
  token: string;
  form: OrderFormFields;
  setForm: Dispatch<SetStateAction<OrderFormFields>>;
  customAnswers: Record<string, unknown>;
  setCustomAnswers: Dispatch<SetStateAction<Record<string, unknown>>>;
  order: OrderFormLoadedOrder | null;
  lockKey: (key: string) => boolean;
  addressConfirmedViaSearch: boolean;
  setAddressConfirmedViaSearch: (v: boolean) => void;
  addressFieldLocked: boolean;
  oneRoomLabel: string;
  propertyTypeOptions: { value: string; label: string }[];
  buildingTypeOptions: { value: string; label: string }[];
  timeSlotOptions: { value: string; label: string }[];
  timeSlotLabels: Record<string, string> | null | undefined;
  requestAreaBasisSelection: (basis: '공급' | '전용') => void;
  handleCustomerPreferredDateChange: (v: string) => void;
  handleCustomerPreferredTimeChange: (raw: string) => void;
  submitting: boolean;
  guideTermsAt: string | null;
  setGuideAgreeModalOpen: (open: boolean) => void;
  /** 제출하기 → 안내 모달 동의 후 자동 제출 */
  markPendingSubmitAfterGuideAgree: () => void;
  agreeLinkLabel: string;
  professionalOptions: ProfessionalSpecialtyOptionDto[];
  profSelections: ProfessionalOptionSelection[];
  setProfSelections: Dispatch<SetStateAction<ProfessionalOptionSelection[]>>;
  toggleProfOption: (id: string) => void;
  setProfQuantity: (id: string, quantity: number) => void;
  setProfUnitAmount: (id: string, raw: string) => void;
  profCatOpen: Record<string, boolean>;
  setProfCatOpen: Dispatch<SetStateAction<Record<string, boolean>>>;
  removeProfInSubtree: (subtree: string[]) => void;
  visibleCustomFields: OrderFormPublicTemplateField[];
  goTo: (id: OrderFormCustomerStepId) => void;
  goNext: () => void;
};

export type CustomerStepBodyProps = CustomerWizardShared & {
  step: OrderFormCustomerStep;
};
