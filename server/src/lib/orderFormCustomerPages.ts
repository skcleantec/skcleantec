/**
 * @generated-sync from shared/orderFormCustomerPages.ts — 직접 수정하지 마세요.
 */
import { parseOrderFormCleaningKind } from './orderFormCleaningKind.js';
import { isOrderFormSectionToggleKey, isOrderFormSectionToggleOn } from './orderFormSectionToggles.js';
import { DEFAULT_ORDER_TIME_SLOT_QUESTION } from './orderFormTimeSlotLabels.js';

/** 손님 발주서 한 페이지. 설정 화면과 손님 화면이 같은 글을 쓴다. */
export type CustomerPageChoice = {
  value: string;
  label: string;
  hint: string;
  imageSrc: string;
};

export type CustomerPageLine = {
  key: string;
  text: string;
};

const DEFAULT_CLEANING_CHOICES: CustomerPageChoice[] = [
  { value: 'MOVE_IN', label: '입주청소', hint: '짐 없는 빈 집', imageSrc: '/orderform/cleaning-kind/move-in.jpg' },
  { value: 'MOVE', label: '이사청소', hint: '짐이 들어오는 날', imageSrc: '/orderform/cleaning-kind/move.jpg' },
  { value: 'HANDOVER', label: '준공청소', hint: '공사 잔재가 있는 현장', imageSrc: '/orderform/cleaning-kind/handover.jpg' },
  { value: 'OCCUPIED', label: '거주청소', hint: '짐이 있는 집', imageSrc: '/orderform/cleaning-kind/occupied.jpg' },
  { value: 'SPECIAL', label: '특수청소', hint: '일반 청소로 안 되는 현장', imageSrc: '/orderform/cleaning-kind/special.jpg' },
];

export type CustomerPageCopy = {
  id: string;
  enabled: boolean;
  removable: boolean;
  title: string;
  hint: string;
  titleLocked: string;
  hintLocked: string;
  titleDetailOnly: string;
  hintDetailOnly: string;
  titleAllSet: string;
  hintAllSet: string;
  titlePartial: string;
  hintPartial: string;
  lines: CustomerPageLine[];
  choices: CustomerPageChoice[];
};

const LOCKED = ['guide', 'review'] as const;

export const CUSTOMER_PAGE_ORDER = [
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

function blankPage(id: string, title: string, hint = ''): CustomerPageCopy {
  return {
    id,
    enabled: true,
    removable: !LOCKED.includes(id as (typeof LOCKED)[number]),
    title,
    hint,
    titleLocked: '',
    hintLocked: '',
    titleDetailOnly: '',
    hintDetailOnly: '',
    titleAllSet: '',
    hintAllSet: '',
    titlePartial: '',
    hintPartial: '',
    lines: [],
    choices: [],
  };
}

/** 지금 손님 발주서에 보이는 문장. 설정을 열면 이 값이 칸에 채워진다. */
export function defaultCustomerPages(): CustomerPageCopy[] {
  const welcome = blankPage(
    'welcome',
    '어떤 청소를 원하세요?',
    '한 가지만 고르고, 아래 그림을 확인한 뒤 「확인」을 눌러 주세요.',
  );
  welcome.lines = [{ key: 'confirm', text: '확인' }];
  welcome.choices = DEFAULT_CLEANING_CHOICES.map((opt) => ({ ...opt }));

  const name = blankPage('name', '고객 성함이 어떻게 되세요?', '예약 확인에 쓰이는 이름입니다.');
  name.titleLocked = '성함이 이렇게 맞나요?';
  name.hintLocked = '상담에서 적어 둔 내용입니다. 맞으면 다음을 눌러 주세요.';

  const address = blankPage('address', '청소할 주소는 어디인가요?', '「주소 검색」으로 선택한 뒤 상세주소를 적어 주세요.');
  address.titleDetailOnly = '상세주소를 알려 주세요';
  address.hintDetailOnly = '동·호수, 층, 상호 등을 적어 주세요. 도로명 주소는 상담에서 이미 정해졌습니다.';
  address.titleAllSet = '주소가 이렇게 맞나요?';
  address.hintAllSet = '상담에서 적어 둔 내용입니다. 맞으면 다음을 눌러 주세요.';
  address.lines = [
    { key: 'searchPlaceholder', text: '주소 검색' },
    { key: 'detailLabel', text: '상세주소' },
    { key: 'detailPlaceholder', text: '동·호수, 층, 상호 등' },
  ];

  const phones = blankPage(
    'phones',
    '연락처를 알려 주세요',
    '보조 연락처는 필수입니다. 전일 연락이 안 되면 서비스가 취소될 수 있으니 정확하게 적어 주세요.',
  );
  phones.lines = [
    { key: 'phone2Label', text: '보조 연락처 (필수) *' },
    { key: 'phone2Placeholder', text: '예: 배우자, 가족 연락처' },
  ];

  const email = blankPage('email', '이메일이 있으신가요?', '제출 확인 메일을 받을 수 있습니다.');

  const property = blankPage('property', '어떤 공간인가요?');
  property.choices = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'].map((label) => ({
    value: label,
    label,
    hint: '',
    imageSrc: '',
  }));

  const area = blankPage(
    'area',
    '공급면적은 얼마인가요?',
    '반드시 평수로 적어 주세요. 제곱미터만 알고 계시면 평으로 환산합니다.',
  );

  const date = blankPage(
    'date',
    '희망 청소일은 언제인가요?',
    '날짜를 정확히 확인해 주세요. 잘못 적으면 위약금이 생길 수 있습니다.',
  );
  date.titleLocked = '희망 청소일이 이렇게 맞나요?';
  date.hintLocked = '상담에서 적어 둔 내용입니다. 맞으면 다음을 눌러 주세요.';

  const time = blankPage('time', DEFAULT_ORDER_TIME_SLOT_QUESTION);
  time.titleLocked = '시간대가 이렇게 맞나요?';
  time.hintLocked = '상담에서 적어 둔 내용입니다. 맞으면 다음을 눌러 주세요.';

  const timeDetail = blankPage('timeDetail', '구체적인 시각을 골라 주세요');

  const rooms = blankPage(
    'rooms',
    '방·화장실·베란다·주방은 어떻게 되나요?',
    '없는 공간은 0으로 적어 주세요. 0이거나 비어 있는 칸은 직접 고칠 수 있습니다.',
  );
  rooms.titleAllSet = '방·화장실·베란다·주방은 이렇게 맞나요?';
  rooms.hintAllSet = '상담에서 적어 둔 내용입니다. 맞으면 다음을 눌러 주세요.';
  rooms.titlePartial = '방·화장실·베란다·주방은 어떻게 되나요?';
  rooms.hintPartial = '이미 적힌 칸은 확인만 하시면 됩니다. 없는 공간은 0으로 적어 주세요.';

  const building = blankPage('building', '건물 형태는요?');
  building.choices = [
    { value: '신축', label: '신축 (5년 이하)', hint: '', imageSrc: '' },
    { value: '구축', label: '구축', hint: '', imageSrc: '' },
    { value: '인테리어', label: '인테리어', hint: '', imageSrc: '' },
    { value: '거주(짐이있는상태)', label: '거주(짐이있는상태)', hint: '', imageSrc: '' },
  ];

  const moveIn = blankPage('moveIn', '입주 시기는요?');
  const notes = blankPage('notes', '추가로 알려 주실 게 있나요?', '전화 상담 내용, 층수·주택 형태 등을 적어 주세요.');
  const photos = blankPage('photos', '현장 사진을 올려 주세요', '없어도 제출할 수 있습니다.');
  const professional = blankPage('professional', '추가로 필요한 작업이 있나요?', '없으면 다음으로 넘어가 주세요.');
  const review = blankPage('review', '이렇게 접수할까요?', '틀린 항목은 눌러서 고칠 수 있습니다.');
  const guide = blankPage('guide', '안내사항을 확인해 주세요', '각 항목을 읽고 체크한 뒤, 맨 아래까지 내려 서명해 주세요.');

  return [
    welcome,
    name,
    address,
    phones,
    email,
    property,
    area,
    date,
    time,
    timeDetail,
    rooms,
    building,
    moveIn,
    notes,
    photos,
    professional,
    review,
    guide,
  ];
}

function clip(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : '';
}

function sanitizeChoice(raw: unknown, index: number): CustomerPageChoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const label = clip(row.label, 80);
  if (!label) return null;
  let value = clip(row.value, 32).toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (!value) value = `OPT_${index + 1}`;
  const imageSrc = clip(row.imageSrc, 400);
  const imageOk = !imageSrc || imageSrc.startsWith('/') || imageSrc.startsWith('https://');
  return {
    value: value.slice(0, 32),
    label,
    hint: clip(row.hint, 160),
    imageSrc: imageOk ? imageSrc : '',
  };
}

function sanitizeLines(raw: unknown): CustomerPageLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerPageLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const key = clip(row.key, 40);
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) continue;
    out.push({ key, text: clip(row.text, 200) });
    if (out.length >= 12) break;
  }
  return out;
}

function overlay(base: CustomerPageCopy, raw: unknown): CustomerPageCopy {
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const choices = Array.isArray(row.choices)
    ? row.choices.map(sanitizeChoice).filter((c): c is CustomerPageChoice => c != null).slice(0, 20)
    : base.choices;
  const locked = LOCKED.includes(base.id as (typeof LOCKED)[number]);
  return {
    ...base,
    enabled: locked ? true : row.enabled === false ? false : true,
    removable: base.removable,
    title: clip(row.title, 120) || base.title,
    hint: row.hint == null ? base.hint : clip(row.hint, 400),
    titleLocked: row.titleLocked == null ? base.titleLocked : clip(row.titleLocked, 120),
    hintLocked: row.hintLocked == null ? base.hintLocked : clip(row.hintLocked, 400),
    titleDetailOnly: row.titleDetailOnly == null ? base.titleDetailOnly : clip(row.titleDetailOnly, 120),
    hintDetailOnly: row.hintDetailOnly == null ? base.hintDetailOnly : clip(row.hintDetailOnly, 400),
    titleAllSet: row.titleAllSet == null ? base.titleAllSet : clip(row.titleAllSet, 120),
    hintAllSet: row.hintAllSet == null ? base.hintAllSet : clip(row.hintAllSet, 400),
    titlePartial: row.titlePartial == null ? base.titlePartial : clip(row.titlePartial, 120),
    hintPartial: row.hintPartial == null ? base.hintPartial : clip(row.hintPartial, 400),
    lines: Array.isArray(row.lines) ? sanitizeLines(row.lines) : base.lines,
    choices,
  };
}

function sanitizeExtra(raw: unknown): CustomerPageCopy | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = clip(row.id, 40);
  if (!/^extra_[a-z0-9]{4,24}$/.test(id)) return null;
  const title = clip(row.title, 120);
  if (!title) return null;
  const page = blankPage(id, title, clip(row.hint, 400));
  page.removable = true;
  page.enabled = row.enabled === false ? false : true;
  page.choices = Array.isArray(row.choices)
    ? row.choices.map(sanitizeChoice).filter((c): c is CustomerPageChoice => c != null).slice(0, 20)
    : [];
  return page;
}

/**
 * 저장된 JSON이 없으면 지금 손님 화면 문장을 그대로 돌려준다.
 * fillMissing false 이면 요청에 없는 기본 페이지(입주 전용 질문)를 다시 넣지 않는다.
 */
export function resolveCustomerPages(stored: unknown, opts?: { fillMissing?: boolean }): CustomerPageCopy[] {
  const fillMissing = opts?.fillMissing !== false;
  const defaults = defaultCustomerPages();
  const rawPages = Array.isArray(stored)
    ? stored
    : stored && typeof stored === 'object' && Array.isArray((stored as { pages?: unknown }).pages)
      ? (stored as { pages: unknown[] }).pages
      : [];
  const byId = new Map<string, unknown>();
  const extras: CustomerPageCopy[] = [];
  for (const item of rawPages) {
    if (!item || typeof item !== 'object') continue;
    const id = clip((item as { id?: unknown }).id, 40);
    if (defaults.some((page) => page.id === id)) byId.set(id, item);
    else {
      const extra = sanitizeExtra(item);
      if (extra) extras.push(extra);
    }
  }
  const catalog = fillMissing ? defaults : defaults.filter((page) => byId.has(page.id));
  return [...catalog.map((page) => overlay(page, byId.get(page.id))), ...extras.slice(0, 12)];
}

export function customerPagesToJson(pages: unknown, opts?: { fillMissing?: boolean }): { pages: CustomerPageCopy[] } {
  return { pages: resolveCustomerPages({ pages: Array.isArray(pages) ? pages : [] }, opts) };
}

export function customerPageById(pages: CustomerPageCopy[] | null | undefined, id: string): CustomerPageCopy | undefined {
  return (pages ?? []).find((page) => page.id === id);
}

export function customerPageLine(page: CustomerPageCopy | undefined, key: string, fallback: string): string {
  const text = page?.lines.find((line) => line.key === key)?.text.trim();
  return text || fallback;
}

export function matchCleaningKindChoice(raw: unknown, pages: CustomerPageCopy[]): string | null {
  const welcome = customerPageById(pages, 'welcome');
  const allowed = new Set((welcome?.choices ?? []).map((choice) => choice.value));
  const text = raw == null ? '' : String(raw).trim().toUpperCase();
  if (text && allowed.has(text)) return text;
  return parseOrderFormCleaningKind(raw);
}

export function labelForCustomerCleaningKind(raw: unknown, pages: CustomerPageCopy[]): string {
  const value = matchCleaningKindChoice(raw, pages);
  if (!value) return raw == null || raw === '' ? '—' : String(raw);
  return customerPageById(pages, 'welcome')?.choices.find((choice) => choice.value === value)?.label ?? value;
}

export function newExtraCustomerPage(): CustomerPageCopy {
  const page = blankPage(`extra_${Math.random().toString(36).slice(2, 10)}`, '새 질문', '');
  page.removable = true;
  return page;
}

export function newCustomerPageChoice(): CustomerPageChoice {
  return {
    value: `OPT_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    label: '새 항목',
    hint: '',
    imageSrc: '',
  };
}

const QUOTE_FIELD_KEYS = new Set([
  'preferredTime',
  'preferredTimeDetail',
  'totalAmount',
  'depositAmount',
  'balanceAmount',
]);

/** 새 발주서를 만들 때 그 양식에 있는 손님 질문만 저장한다. 입주 기본은 전체. */
export function customerPagesSnapshotForTemplate(
  isDefault: boolean,
  fields: Array<{ systemField?: string | null; options?: unknown }>,
): CustomerPageCopy[] {
  const all = defaultCustomerPages();
  if (isDefault) return all;
  const systemFields = fields
    .filter((field) => field.systemField)
    .map((field) => ({
      systemField: String(field.systemField),
      options: Array.isArray(field.options) ? field.options.map((item) => String(item)) : null,
    }));
  const on = (key: string) => {
    if (QUOTE_FIELD_KEYS.has(key)) return true;
    if (isOrderFormSectionToggleKey(key)) {
      return isOrderFormSectionToggleOn({ isDefault: false, systemFields }, key);
    }
    return systemFields.some((field) => field.systemField === key);
  };
  const ids = new Set<string>();
  if (on('customerName')) ids.add('name');
  if (on('address')) ids.add('address');
  if (on('customerPhone')) ids.add('phones');
  if (on('customerEmail')) ids.add('email');
  if (on('propertyType')) ids.add('property');
  if (on('areaPyeong')) ids.add('area');
  if (on('preferredDate') || on('preferredTime')) ids.add('date');
  if (on('preferredTime')) ids.add('time');
  if (on('preferredTimeDetail')) ids.add('timeDetail');
  if (on('roomCount')) ids.add('rooms');
  if (on('buildingType')) ids.add('building');
  if (on('moveInDate')) ids.add('moveIn');
  if (on('specialNotes')) ids.add('notes');
  if (on('photos')) ids.add('photos');
  if (on('professionalOptions')) ids.add('professional');
  ids.add('review');
  ids.add('guide');
  return all.filter((page) => ids.has(page.id));
}
