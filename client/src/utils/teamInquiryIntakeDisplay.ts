import type { InquiryIntakeFormProfile } from '@shared/inquiryFormProfile';
import {
  formatInquiryStructureByProfile,
  inquiryCustomAnswerRows,
  inquiryIntakeListChips,
  inquiryIntakeShowsArea,
  inquiryIntakeShowsField,
  inquiryIntakeShowsMoveIn,
  inquiryIntakeShowsPropertySection,
  type InquiryIntakeCustomRow,
} from '@shared/inquiryIntakeDisplay';
import type { OrderFormListSnapshot } from '@shared/orderFormListSnapshot';
import { inquiryOrderFormAnswersFromItem } from './inquiryOrderFormAnswers';
import { teamT } from '../i18n/team/teamI18n';

export type TeamInquiryIntakeItem = {
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  kitchenCount?: number | null;
  intakeFormProfile?: InquiryIntakeFormProfile | null;
  intakeCustomAnswers?: Record<string, unknown> | null;
  orderFormListSnapshot?: OrderFormListSnapshot | null;
  orderForm?: {
    customerAnswers?: Record<string, unknown> | null;
    prefillAnswers?: Record<string, unknown> | null;
    submittedAt?: string | null;
  } | null;
};

export function teamInquiryShowsField(item: TeamInquiryIntakeItem, key: string): boolean {
  return inquiryIntakeShowsField(item.intakeFormProfile, key);
}

export function teamInquiryShowsArea(item: TeamInquiryIntakeItem): boolean {
  return inquiryIntakeShowsArea(item.intakeFormProfile);
}

export function teamInquiryShowsPropertySection(item: TeamInquiryIntakeItem): boolean {
  return inquiryIntakeShowsPropertySection(item.intakeFormProfile);
}

export function teamInquiryShowsMoveIn(item: TeamInquiryIntakeItem): boolean {
  return inquiryIntakeShowsMoveIn(item.intakeFormProfile);
}

export function formatTeamInquiryStructure(item: TeamInquiryIntakeItem): string {
  return formatInquiryStructureByProfile(item, item.intakeFormProfile, {
    room: teamT('team.room.room'),
    bath: teamT('team.room.bath'),
    veranda: teamT('team.room.veranda'),
    empty: teamT('team.common.emDash'),
  });
}

export function teamInquiryCustomAnswers(item: TeamInquiryIntakeItem): Record<string, unknown> {
  return inquiryOrderFormAnswersFromItem(item);
}

export function teamInquiryCustomRows(item: TeamInquiryIntakeItem): InquiryIntakeCustomRow[] {
  return inquiryCustomAnswerRows(item.intakeFormProfile, teamInquiryCustomAnswers(item));
}

export function teamInquiryListChips(item: TeamInquiryIntakeItem): InquiryIntakeCustomRow[] {
  return inquiryIntakeListChips(
    item.intakeFormProfile,
    teamInquiryCustomAnswers(item),
    item.orderFormListSnapshot,
  );
}

export function formatTeamInquiryPropertyParts(item: TeamInquiryIntakeItem & {
  areaSummary?: string;
  propertyType?: string | null;
}): string[] {
  const parts: string[] = [];
  const area = item.areaSummary?.trim();
  if (area && area !== teamT('team.common.emDash') && teamInquiryShowsArea(item)) parts.push(area);
  const structure = formatTeamInquiryStructure(item);
  if (structure && structure !== teamT('team.common.emDash')) parts.push(structure);
  const propertyType = item.propertyType?.trim();
  if (propertyType && teamInquiryShowsField(item, 'propertyType')) parts.push(propertyType);
  return parts;
}
