/** 발주서 칸별 작성 주체 — 고객 / 마케터 / 필수 (겹침 가능) */

export type OrderFormFillRuleFlags = {
  customer: boolean;
  marketer: boolean;
  required: boolean;
};

export type OrderFormFillRuleKey =
  | 'customerName'
  | 'address'
  | 'customerPhone'
  | 'customerPhone2'
  | 'customerEmail'
  | 'propertyType'
  | 'areaPyeong'
  | 'preferredDate'
  | 'preferredTime'
  | 'preferredTimeDetail'
  | 'roomCount'
  | 'buildingType'
  | 'moveInDate'
  | 'specialNotes'
  | 'photos'
  | 'professionalOptions';

export type OrderFormFillRules = Record<OrderFormFillRuleKey, OrderFormFillRuleFlags>;

export type IssueFormSectionId =
  | 'name'
  | 'address'
  | 'contact'
  | 'property'
  | 'date'
  | 'time'
  | 'timeDetail'
  | 'rooms'
  | 'building'
  | 'moveIn'
  | 'notes'
  | 'photos'
  | 'professional';

export type OrderFormFillRuleFieldMeta = {
  key: OrderFormFillRuleKey;
  section: IssueFormSectionId;
  label: string;
  help: string;
};

const BOTH_REQUIRED: OrderFormFillRuleFlags = { customer: true, marketer: true, required: true };
const BOTH_OPTIONAL: OrderFormFillRuleFlags = { customer: true, marketer: true, required: false };
const MARKETER_REQUIRED: OrderFormFillRuleFlags = { customer: false, marketer: true, required: true };

/** 지금 발주서와 같은 기본 체크 — 면적만 상담사 필수(고객이 공급/전용을 고르지 않음) */
export const DEFAULT_ORDER_FORM_FILL_RULES: OrderFormFillRules = {
  customerName: { ...BOTH_REQUIRED },
  address: { ...BOTH_REQUIRED },
  customerPhone: { ...BOTH_REQUIRED },
  customerPhone2: { ...BOTH_REQUIRED },
  customerEmail: { ...BOTH_REQUIRED },
  propertyType: { ...BOTH_REQUIRED },
  areaPyeong: { ...MARKETER_REQUIRED },
  preferredDate: { ...BOTH_REQUIRED },
  preferredTime: { ...BOTH_REQUIRED },
  preferredTimeDetail: { ...BOTH_REQUIRED },
  roomCount: { ...BOTH_REQUIRED },
  buildingType: { ...BOTH_REQUIRED },
  moveInDate: { ...BOTH_REQUIRED },
  specialNotes: { ...BOTH_REQUIRED },
  photos: { ...BOTH_OPTIONAL },
  professionalOptions: { ...BOTH_OPTIONAL },
};

export const ORDER_FORM_FILL_RULE_FIELDS: readonly OrderFormFillRuleFieldMeta[] = [
  {
    key: 'customerName',
    section: 'name',
    label: '성함',
    help: '예약 확인에 쓰는 이름입니다. 지금처럼 상담사와 고객 모두 적을 수 있고, 반드시 채워져야 합니다.',
  },
  {
    key: 'address',
    section: 'address',
    label: '주소',
    help: '도로명 검색과 상세주소(동·호수)입니다. 상담사가 도로명만 넣으면 고객이 상세를 이어서 적습니다.',
  },
  {
    key: 'customerPhone',
    section: 'contact',
    label: '대표 연락처',
    help: '고객과 연락하는 대표 번호입니다.',
  },
  {
    key: 'customerPhone2',
    section: 'contact',
    label: '보조 연락처',
    help: '전일 연락이 안 될 때를 대비한 가족·배우자 번호입니다. 지금은 반드시 적습니다.',
  },
  {
    key: 'customerEmail',
    section: 'contact',
    label: '이메일',
    help: '제출 확인 메일을 받는 주소입니다.',
  },
  {
    key: 'propertyType',
    section: 'property',
    label: '건축물 유형',
    help: '아파트·오피스텔·원룸 등 공간 종류입니다.',
  },
  {
    key: 'areaPyeong',
    section: 'property',
    label: '면적 (공급·전용·평수)',
    help: '공급면적과 전용면적은 고객이 구분하기 어렵습니다. 기본은 상담사만 적고, 비우면 링크가 만들어지지 않습니다.',
  },
  {
    key: 'preferredDate',
    section: 'date',
    label: '청소날짜',
    help: '서비스를 받을 날입니다. 상담사가 비우면 고객이 고릅니다.',
  },
  {
    key: 'preferredTime',
    section: 'time',
    label: '시간대',
    help: '오전·오후·사이청소 등 시간대입니다.',
  },
  {
    key: 'preferredTimeDetail',
    section: 'timeDetail',
    label: '구체적 시각',
    help: '사이청소처럼 시각이 필요할 때 쓰는 칸입니다.',
  },
  {
    key: 'roomCount',
    section: 'rooms',
    label: '방·베란다·화장실·주방',
    help: '없는 공간은 0으로 적습니다. 0이거나 비어 있으면 고객이 고칠 수 있습니다.',
  },
  {
    key: 'buildingType',
    section: 'building',
    label: '신축/구축/인테리어/거주',
    help: '건물 상태 선택입니다.',
  },
  {
    key: 'moveInDate',
    section: 'moveIn',
    label: '이사 날짜',
    help: '입주·이사 시기입니다. 미정이면 고객이 표시할 수 있습니다.',
  },
  {
    key: 'specialNotes',
    section: 'notes',
    label: '특이사항',
    help: '층수·주택 형태·상담 메모 등입니다. 「특이사항 없음」을 켜면 빈 칸으로 둘 수 있습니다.',
  },
  {
    key: 'photos',
    section: 'photos',
    label: '현장 사진',
    help: '지금은 없어도 제출할 수 있습니다.',
  },
  {
    key: 'professionalOptions',
    section: 'professional',
    label: '전문 시공',
    help: '추가 작업 선택입니다. 지금은 없어도 됩니다.',
  },
];

export const ISSUE_FORM_SECTION_TABS: readonly {
  id: IssueFormSectionId;
  label: string;
  help: string;
}[] = [
  { id: 'name', label: '성함', help: '고객 이름을 적는 칸입니다.' },
  { id: 'address', label: '주소', help: '청소할 위치(도로명·상세주소)입니다.' },
  { id: 'contact', label: '연락처', help: '대표·보조 전화와 이메일입니다.' },
  { id: 'property', label: '건축물·면적', help: '공간 종류와 공급·전용 평수입니다. 면적은 기본으로 상담사가 적습니다.' },
  { id: 'date', label: '청소날짜', help: '서비스를 받을 날입니다.' },
  { id: 'time', label: '시간대', help: '오전·오후 등 시간대입니다.' },
  { id: 'timeDetail', label: '구체적 시각', help: '사이청소처럼 시각이 필요할 때 씁니다.' },
  { id: 'rooms', label: '방·화장실', help: '방·베란다·화장실·주방 수입니다.' },
  { id: 'building', label: '건물상태', help: '신축·구축·인테리어·거주 선택입니다.' },
  { id: 'moveIn', label: '이사 날짜', help: '입주·이사 시기입니다.' },
  { id: 'notes', label: '특이사항', help: '추가로 남길 메모입니다.' },
  { id: 'photos', label: '사진', help: '현장 사진입니다. 지금은 선택이입니다.' },
  { id: 'professional', label: '전문시공', help: '추가 시공 옵션입니다. 지금은 선택이입니다.' },
];

export const ISSUE_FILL_RULES_PAGE_HELP =
  '칸마다 「고객」「마케터」「필수」를 켤 수 있고, 여러 개를 같이 켤 수 있습니다.\n\n' +
  '· 아무 것도 안 켜면: 누구나 적어도 되고, 안 해도 됩니다.\n' +
  '· 필수만 켜면: 상담사 또는 고객 중 한 명은 반드시 적습니다. 발급할 때 비워 두어도 됩니다.\n' +
  '· 고객 + 필수: 고객만 적을 수 있고, 꼭 적어야 합니다.\n' +
  '· 마케터 + 필수: 상담사만 적을 수 있고, 비우면 링크가 만들어지지 않습니다.\n\n' +
  '처음 보이는 체크는 지금 발주서와 같습니다. 면적만 상담사가 꼭 적도록 되어 있습니다.';

const RULE_KEYS = new Set<string>(ORDER_FORM_FILL_RULE_FIELDS.map((f) => f.key));

export function isOrderFormFillRuleKey(v: string): v is OrderFormFillRuleKey {
  return RULE_KEYS.has(v);
}

export function isIssueFormSectionId(v: string | null | undefined): v is IssueFormSectionId {
  return ISSUE_FORM_SECTION_TABS.some((t) => t.id === v);
}

export function emptyFillFlags(): OrderFormFillRuleFlags {
  return { customer: false, marketer: false, required: false };
}

export function normalizeFillFlags(raw: unknown): OrderFormFillRuleFlags {
  if (!raw || typeof raw !== 'object') return emptyFillFlags();
  const o = raw as Record<string, unknown>;
  return {
    customer: o.customer === true,
    marketer: o.marketer === true,
    required: o.required === true,
  };
}

export function mergeOrderFormFillRules(raw: unknown): OrderFormFillRules {
  const out = { ...DEFAULT_ORDER_FORM_FILL_RULES };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const rec = raw as Record<string, unknown>;
  for (const meta of ORDER_FORM_FILL_RULE_FIELDS) {
    if (rec[meta.key] != null) out[meta.key] = normalizeFillFlags(rec[meta.key]);
  }
  return out;
}

export function sanitizeOrderFormFillRulesForSave(raw: unknown): OrderFormFillRules {
  const merged = mergeOrderFormFillRules(raw);
  const out = { ...DEFAULT_ORDER_FORM_FILL_RULES };
  for (const meta of ORDER_FORM_FILL_RULE_FIELDS) {
    out[meta.key] = normalizeFillFlags(merged[meta.key]);
  }
  return out;
}

/** 고객·마케터 둘 다 꺼짐 = 누구나 작성 가능 */
export function canCustomerWrite(flags: OrderFormFillRuleFlags): boolean {
  if (!flags.customer && !flags.marketer) return true;
  return flags.customer;
}

export function canMarketerWrite(flags: OrderFormFillRuleFlags): boolean {
  if (!flags.customer && !flags.marketer) return true;
  return flags.marketer;
}

export function isFillRequired(flags: OrderFormFillRuleFlags): boolean {
  return flags.required;
}

/** 상담사만 + 필수 → 발급 시 반드시 채움 */
export function marketerMustFillAtIssue(flags: OrderFormFillRuleFlags): boolean {
  return flags.required && canMarketerWrite(flags) && !canCustomerWrite(flags);
}

export function customerMaySkipAtSubmit(flags: OrderFormFillRuleFlags): boolean {
  return !flags.required;
}

export function fillRuleOf(rules: OrderFormFillRules, key: OrderFormFillRuleKey): OrderFormFillRuleFlags {
  return rules[key] ?? DEFAULT_ORDER_FORM_FILL_RULES[key];
}

/** 공개 고객 API — 작성 가능·필수만 */
export function toPublicFillRules(rules: OrderFormFillRules): Record<
  OrderFormFillRuleKey,
  { customer: boolean; required: boolean }
> {
  const out = {} as Record<OrderFormFillRuleKey, { customer: boolean; required: boolean }>;
  for (const meta of ORDER_FORM_FILL_RULE_FIELDS) {
    const f = fillRuleOf(rules, meta.key);
    out[meta.key] = { customer: canCustomerWrite(f), required: f.required };
  }
  return out;
}

export function parsePublicFillRules(raw: unknown): Record<
  OrderFormFillRuleKey,
  { customer: boolean; required: boolean }
> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const out = {} as Record<OrderFormFillRuleKey, { customer: boolean; required: boolean }>;
  for (const meta of ORDER_FORM_FILL_RULE_FIELDS) {
    const row = rec[meta.key];
    if (row && typeof row === 'object') {
      const o = row as Record<string, unknown>;
      out[meta.key] = { customer: o.customer === true, required: o.required === true };
    } else {
      const d = DEFAULT_ORDER_FORM_FILL_RULES[meta.key];
      out[meta.key] = { customer: canCustomerWrite(d), required: d.required };
    }
  }
  return out;
}
