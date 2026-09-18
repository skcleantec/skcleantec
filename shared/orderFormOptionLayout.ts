/** 발주서 선택지 배치 — 구글 설문과 같은 세로 / 가로 / 두 칸 */
export const ORDER_FORM_OPTION_LAYOUTS = ['VERTICAL', 'HORIZONTAL', 'COLS_2'] as const;
export type OrderFormOptionLayout = (typeof ORDER_FORM_OPTION_LAYOUTS)[number];

export function normalizeOrderFormOptionLayout(v: unknown): OrderFormOptionLayout {
  if (v === 'HORIZONTAL' || v === 'COLS_2' || v === 'VERTICAL') return v;
  return 'VERTICAL';
}

export function orderFormChoiceIsMulti(inputType: string): boolean {
  return inputType === 'MULTISELECT' || inputType === 'CHECKBOX';
}

/** 라디오·체크 목록으로 그릴지 (아니면 SELECT 드롭다운) */
export function orderFormChoiceUsesOptionList(
  inputType: string,
  optionStyle: string | null | undefined,
): boolean {
  if (orderFormChoiceIsMulti(inputType)) return true;
  return inputType === 'SELECT' && optionStyle === 'RADIO';
}

export function orderFormChoiceLayoutClass(layout: OrderFormOptionLayout): string {
  if (layout === 'HORIZONTAL') return 'flex flex-wrap gap-2';
  if (layout === 'COLS_2') return 'grid grid-cols-1 gap-2 sm:grid-cols-2';
  return 'flex flex-col gap-2';
}
