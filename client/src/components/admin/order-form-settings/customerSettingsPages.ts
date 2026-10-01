import { isOrderFormPackQuoteFieldKey } from '@shared/orderFormIndustryPacks';
import { isOrderFormSectionToggleKey, isOrderFormSectionToggleOn } from '@shared/orderFormSectionToggles';

/** 손님 발주서에 나오는 질문 순서. 기본 입주 발주서는 이 목록 전부. */
const CUSTOMER_PAGE_ORDER = [
  'welcome',
  'name',
  'address',
  'phones',
  'email',
  'property',
  'area',
  'date',
  'time',
  'timeDetail',
  'rooms',
  'building',
  'moveIn',
  'notes',
  'photos',
  'professional',
  'review',
  'guide',
] as const;

type SettingsTemplate = {
  isDefault?: boolean | null;
  renderMode?: string | null;
  fields?: Array<{ systemField?: string | null; options?: unknown }>;
};

function systemFieldOn(template: SettingsTemplate, key: string): boolean {
  if (isOrderFormPackQuoteFieldKey(key)) return true;
  const fields = template.fields ?? [];
  const systemFields = fields
    .filter((field) => field.systemField)
    .map((field) => ({
      systemField: field.systemField as string,
      options: Array.isArray(field.options) ? field.options.map((item) => String(item)) : null,
    }));
  if (isOrderFormSectionToggleKey(key)) {
    return isOrderFormSectionToggleOn({ isDefault: template.isDefault, systemFields }, key);
  }
  if (template.isDefault) return true;
  if (template.renderMode && template.renderMode !== 'TEMPLATE') return true;
  const mapped = systemFields.map((field) => field.systemField);
  if (mapped.length === 0) return true;
  return mapped.includes(key);
}

/** 이 발주서 손님이 보는 질문만. 기본 입주 발주서는 지금 목록을 유지한다. */
export function visibleCustomerSettingsPageIds(template: SettingsTemplate): string[] {
  if (template.isDefault) return [...CUSTOMER_PAGE_ORDER];
  const ids: string[] = [];
  if (systemFieldOn(template, 'customerName')) ids.push('name');
  if (systemFieldOn(template, 'address')) ids.push('address');
  if (systemFieldOn(template, 'customerPhone')) ids.push('phones');
  if (systemFieldOn(template, 'customerEmail')) ids.push('email');
  if (systemFieldOn(template, 'propertyType')) ids.push('property');
  if (systemFieldOn(template, 'areaPyeong')) ids.push('area');
  if (systemFieldOn(template, 'preferredDate') || systemFieldOn(template, 'preferredTime')) ids.push('date');
  if (systemFieldOn(template, 'preferredTime')) ids.push('time');
  if (systemFieldOn(template, 'preferredTimeDetail')) ids.push('timeDetail');
  if (systemFieldOn(template, 'roomCount')) ids.push('rooms');
  if (systemFieldOn(template, 'buildingType')) ids.push('building');
  if (systemFieldOn(template, 'moveInDate')) ids.push('moveIn');
  if (systemFieldOn(template, 'specialNotes')) ids.push('notes');
  if (systemFieldOn(template, 'photos')) ids.push('photos');
  if (systemFieldOn(template, 'professionalOptions')) ids.push('professional');
  ids.push('review', 'guide');
  return ids;
}

export function pagesForCustomerSettings<T extends { id: string }>(template: SettingsTemplate, pages: T[]): T[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const body = visibleCustomerSettingsPageIds(template)
    .filter((id) => id !== 'review' && id !== 'guide')
    .map((id) => byId.get(id))
    .filter((page): page is T => page != null);
  const extras = pages.filter((page) => page.id.startsWith('extra_'));
  const end = ['review', 'guide'].map((id) => byId.get(id)).filter((page): page is T => page != null);
  return [...body, ...extras, ...end];
}
