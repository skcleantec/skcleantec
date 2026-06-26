import {
  EContractAudience,
  EContractFieldFilledBy,
  EContractFieldInputType,
} from '@prisma/client';
import {
  EC_CONTRACT_DATE_TOKEN,
  EC_SIGNATURE_TOKEN,
} from './eContractField.tokens.js';

export type DefaultEContractFieldSpec = {
  token: string;
  label: string;
  inputType: EContractFieldInputType;
  filledBy: EContractFieldFilledBy;
  required: boolean;
  sortOrder: number;
};

/** 팀원 계약 — 팀장(을)과 동일한 체결 입력 항목 */
export const TEAM_MEMBER_DEFAULT_FIELD_SPECS: readonly DefaultEContractFieldSpec[] = [
  {
    token: '[[EC_SIGNER_NAME]]',
    label: '(을) 성함',
    inputType: EContractFieldInputType.TEXT,
    filledBy: EContractFieldFilledBy.SIGNER,
    required: true,
    sortOrder: 10,
  },
  {
    token: '[[EC_SIGNER_RRN]]',
    label: '(을) 주민등록번호',
    inputType: EContractFieldInputType.RRN,
    filledBy: EContractFieldFilledBy.SIGNER,
    required: true,
    sortOrder: 20,
  },
  {
    token: '[[EC_SIGNER_ADDRESS]]',
    label: '(을) 주소',
    inputType: EContractFieldInputType.TEXTAREA,
    filledBy: EContractFieldFilledBy.SIGNER,
    required: true,
    sortOrder: 30,
  },
  {
    token: '[[EC_SIGNER_PHONE]]',
    label: '(을) 연락처',
    inputType: EContractFieldInputType.PHONE,
    filledBy: EContractFieldFilledBy.SIGNER,
    required: true,
    sortOrder: 40,
  },
  {
    token: '[[EC_SIGNER_FREETEXT]]',
    label: '(을) 추가 기재(선택)',
    inputType: EContractFieldInputType.TEXTAREA,
    filledBy: EContractFieldFilledBy.SIGNER,
    required: false,
    sortOrder: 50,
  },
  {
    token: EC_SIGNATURE_TOKEN,
    label: '(을) 서명',
    inputType: EContractFieldInputType.TEXT,
    filledBy: EContractFieldFilledBy.SIGNER,
    required: true,
    sortOrder: 60,
  },
  {
    token: EC_CONTRACT_DATE_TOKEN,
    label: '계약일',
    inputType: EContractFieldInputType.DATE,
    filledBy: EContractFieldFilledBy.AUTO,
    required: true,
    sortOrder: 100,
  },
];

export const DEFAULT_FIELD_SPECS_BY_AUDIENCE: Partial<
  Record<EContractAudience, readonly DefaultEContractFieldSpec[]>
> = {
  [EContractAudience.TEAM_MEMBER]: TEAM_MEMBER_DEFAULT_FIELD_SPECS,
};
