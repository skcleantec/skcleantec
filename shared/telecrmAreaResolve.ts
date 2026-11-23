/** 텔레CRM 면적 해석 — 화면·서버가 같이 쓰는 결과. */

export type TelecrmAreaStatus = '확정' | '확인 필요';
export type TelecrmAreaSource = '건축물대장' | '사장님 기준' | '사례' | '기본 규칙';

export type TelecrmAreaCandidate = { label: string; pyeong: number };

export type TelecrmAreaResolveResult = {
  pyeong: number | null;
  status: TelecrmAreaStatus;
  candidates: TelecrmAreaCandidate[];
  reason: string;
  source: TelecrmAreaSource;
  /** 사례로 남길 고객 숫자. 없으면 저장하지 않는다. */
  customerValue: number | null;
  /** 공급·전용·분양. 없으면 표시가 없던 숫자. */
  customerMark: string | null;
  /** 단위 없는 숫자를 ㎡로 다시 읽었으면 sqm. */
  reinterpreted?: 'sqm' | null;
  /** 평으로 읽었을 때의 값. 되돌릴 때 쓴다. */
  literalPyeong?: number | null;
};

export type TelecrmAreaRuleKind = 'assume' | 'confirmBand' | 'complex' | 'ratio' | 'basis';

/** 가격 규칙과 따로 두는 면적 기준 */
export type TelecrmAreaRuleSpec = {
  kind: TelecrmAreaRuleKind;
  summary: string;
  buildingType?: string;
  pyeongMin?: number;
  pyeongMax?: number;
  assume?: '전용' | '공급';
  requireConfirm?: boolean;
  address?: string;
  customerValue?: number;
  supplyPyeong?: number;
  exclusiveRatio?: number;
  apartmentBasis?: '공급' | '전용';
  otherBasis?: '공급' | '전용';
};

export type TelecrmAreaRuleDto = {
  id: string;
  spec: TelecrmAreaRuleSpec;
  summary: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

export type TelecrmAreaRuleDraft = {
  spec: TelecrmAreaRuleSpec;
  preview: string;
  examples: string[];
};
