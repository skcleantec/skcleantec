/**
 * 접수 칸 카탈로그(이름·전화·주소 등). 화면 스위치는 없고, 사용함 발주서 양식이 칸 목록을 정한다.
 * 기본 입주청소 손님 화면은 isDefault 양식이 그대로 담당한다.
 */

export const INTAKE_IDENTITY_FIELD_KEYS = ['customerName', 'customerPhone', 'address', 'preferredDate'] as const;

export type InquiryIntakeFieldGroupId = 'identity' | 'schedule' | 'property' | 'amounts' | 'extra';

export type InquiryIntakeFieldDef = {
  key: string;
  label: string;
  group: InquiryIntakeFieldGroupId;
  locked: boolean;
};

export const INQUIRY_INTAKE_FIELD_GROUPS: Array<{ id: InquiryIntakeFieldGroupId; title: string }> = [
  { id: 'identity', title: '꼭 있는 칸' },
  { id: 'schedule', title: '일정' },
  { id: 'property', title: '건물·이사' },
  { id: 'amounts', title: '금액' },
  { id: 'extra', title: '기타' },
];

export const INQUIRY_INTAKE_FIELD_CATALOG: InquiryIntakeFieldDef[] = [
  { key: 'customerName', label: '고객명', group: 'identity', locked: true },
  { key: 'customerPhone', label: '전화번호', group: 'identity', locked: true },
  { key: 'address', label: '주소', group: 'identity', locked: true },
  { key: 'preferredDate', label: '서비스희망일', group: 'identity', locked: true },
  { key: 'preferredTime', label: '시간대', group: 'schedule', locked: false },
  { key: 'preferredTimeDetail', label: '구체적 시각', group: 'schedule', locked: false },
  { key: 'propertyType', label: '건축물 유형', group: 'property', locked: false },
  { key: 'buildingType', label: '신축/구축', group: 'property', locked: false },
  { key: 'moveInDate', label: '이사일', group: 'property', locked: false },
  { key: 'areaPyeong', label: '평수', group: 'property', locked: false },
  { key: 'addressDetail', label: '상세주소', group: 'property', locked: false },
  { key: 'roomCount', label: '방 개수', group: 'property', locked: false },
  { key: 'bathroomCount', label: '화장실 개수', group: 'property', locked: false },
  { key: 'balconyCount', label: '베란다 개수', group: 'property', locked: false },
  { key: 'kitchenCount', label: '주방 개수', group: 'property', locked: false },
  { key: 'totalAmount', label: '금액(총액)', group: 'amounts', locked: false },
  { key: 'depositAmount', label: '예약금', group: 'amounts', locked: false },
  { key: 'balanceAmount', label: '잔금', group: 'amounts', locked: false },
  { key: 'customerPhone2', label: '보조 전화번호', group: 'extra', locked: false },
  { key: 'customerEmail', label: '이메일', group: 'extra', locked: false },
  { key: 'specialNotes', label: '특이사항', group: 'extra', locked: false },
  { key: 'photos', label: '현장 사진 첨부', group: 'extra', locked: false },
  { key: 'professionalOptions', label: '전문 시공 옵션', group: 'extra', locked: false },
];

const KNOWN_INTAKE_KEYS = new Set(INQUIRY_INTAKE_FIELD_CATALOG.map((f) => f.key));

export function allInquiryIntakeFieldKeys(): string[] {
  return INQUIRY_INTAKE_FIELD_CATALOG.map((f) => f.key);
}

/** null / 잘못된 값 = 아직 안 정함(전부 표시). 배열이면 저장본. */
export function parseStoredInquiryIntakeKeys(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const keys = raw.map((x) => String(x).trim()).filter((k) => KNOWN_INTAKE_KEYS.has(k));
  if (keys.length === 0) return null;
  return normalizeInquiryIntakeKeys(keys);
}

export function normalizeInquiryIntakeKeys(keys: string[]): string[] {
  const next = new Set<string>(INTAKE_IDENTITY_FIELD_KEYS);
  for (const key of keys) {
    if (KNOWN_INTAKE_KEYS.has(key)) next.add(key);
  }
  return INQUIRY_INTAKE_FIELD_CATALOG.filter((f) => next.has(f.key)).map((f) => f.key);
}

export function inquiryIntakeKeysForDisplay(stored: string[] | null): string[] {
  return stored ?? allInquiryIntakeFieldKeys();
}
