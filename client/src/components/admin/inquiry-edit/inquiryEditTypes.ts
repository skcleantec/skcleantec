import type { InternalCustomerTone } from '../../../constants/internalCustomerTone';
import type { LeaderCrewSet } from '../../../utils/leaderCrewSets';

/** 접수 수정 모달 폼 필드 (ScheduleInquiryDetailModal 공통) */
export type InquiryEditFormFields = {
  customerName: string;
  nickname: string;
  customerPhone: string;
  address: string;
  addressDetail: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  preferredDate: string;
  preferredTime: string;
  betweenScheduleSlot: string;
  preferredTimeDetail: string;
  memo: string;
  teamLeaderIds: string[];
  /** 담당 팀장 + 팀원 세트 (UI 원본) */
  leaderCrewSets: LeaderCrewSet[];
  crewMemberCount: number;
  crewMemberNames: string[];
  /** 팀원 슬롯별 담당 팀장 id (복수 비단독 팀장일 때) */
  crewMemberLeaderIds: string[];
  soloTeamLeaderIds: string[];
  status: string;
  createdById: string;
  collaborationMarketerId: string;
  operatingCompanyId: string;
  customerPhone2: string;
  propertyType: string;
  isOneRoom: boolean;
  areaBasis: string;
  areaPyeong: string;
  exclusiveAreaSqm: string;
  buildingType: string;
  moveInDate: string;
  moveInDateUndecided: boolean;
  kitchenCount: string;
  amountTotal: string;
  amountDeposit: string;
  amountBalance: string;
  externalTransferFee: string;
  scheduleMemo: string;
  specialNotes: string;
  consultationMemo: string;
  internalCustomerTone: InternalCustomerTone;
  professionalOptionIds: string[];
  /** 유입 플랫폼 — Inquiry.source (카탈로그 label) */
  leadSource: string;
};
