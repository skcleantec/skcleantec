import {
  matchTelecrmChoiceByText,
  type TelecrmPropertyChoiceOptions,
} from '@shared/telecrmQuoteCrewLearning';

export type CrmImportedPropertyChoice = {
  propertyType: string;
  buildingType: string;
  isOneRoom: boolean;
};

/**
 * 숨고·미소에서 온 자유 글(「아파트」「신축」 등)을 업체 발주서 선택지 저장값으로 바꾼다.
 * 앞의 글부터 확인하고, 맞는 선택지가 없으면 빈 값으로 둔다.
 */
export function matchCrmImportedPropertyChoice(
  options: TelecrmPropertyChoiceOptions,
  texts: (string | null | undefined)[],
): CrmImportedPropertyChoice {
  const list = texts.map((t) => (t ?? '').trim()).filter(Boolean);
  let propertyType = '';
  let buildingType = '';
  for (const text of list) {
    if (!propertyType) propertyType = matchTelecrmChoiceByText(options.propertyTypes, text);
    if (!buildingType) buildingType = matchTelecrmChoiceByText(options.buildingTypes, text);
  }
  const isOneRoom = list.some((t) => t.replace(/\s+/g, '').includes('원룸'));
  return { propertyType, buildingType, isOneRoom };
}
