/**
 * @generated-sync from shared/inquiryInspectionCaptureGuides.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionCaptureGuides.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

const HINTS: Readonly<Record<string, string>> = {
  inside_door: '안쪽문 전체와 손잡이·틈새가 보이게 촬영해 주세요.',
  entrance_door_inner: '현관문 안쪽 면과 문틀·손잡이를 함께 담아 주세요.',
  shoe_closet: '신발장 내부·선반·바닥이 잘 보이게 촬영해 주세요.',
  sensor_light: '센서등과 주변 천장·벽을 함께 촬영해 주세요.',
  floor: '바닥 전체와 모서리·걸레받이 쪽이 보이게 촬영해 주세요.',
  ceiling: '천장 전체와 조명 주변을 촬영해 주세요.',
  baseboard: '걸레받이와 바닥·벽 경계가 선명히 보이게 촬영해 주세요.',
  mirror: '거울 전체와 주변 벽·틈새가 보이게 촬영해 주세요.',
  storage: '수납장 겉면·손잡이·틈새를 촬영해 주세요.',
  light: '전등과 주변 천장·벽을 함께 촬영해 주세요.',
  molding: '몰딩과 벽·천장 경계가 보이게 촬영해 주세요.',
  wall: '벽면 전체와 얼룩·손자국이 보이는 각도로 촬영해 주세요.',
  switch: '스위치와 주변 벽면을 가까이 촬영해 주세요.',
  outlet: '콘센트와 주변 벽면을 가까이 촬영해 주세요.',
  emergency_light: '비상등과 주변 천장을 촬영해 주세요.',
  intercom: '인터폰과 주변 벽면을 촬영해 주세요.',
  pantry: '팬트리 내부·선반·바닥이 보이게 촬영해 주세요.',
  sink_faucet: '싱크대·수전·주변 타일을 함께 촬영해 주세요.',
  hood: '후드 겉면과 필터·하부가 보이게 촬영해 주세요.',
  aux_cabinet: '보조 식기장 겉면과 손잡이·틈새를 촬영해 주세요.',
  cooktop: '가스레인지/인덕션 상판과 주변을 촬영해 주세요.',
  cabinet: '상·하부장 겉면과 손잡이·틈새를 촬영해 주세요.',
  island: '아일랜드 상판·측면이 보이게 촬영해 주세요.',
  window: '창틀·창문과 주변 벽·틈새를 촬영해 주세요.',
  fridge_exterior: '냉장고 겉면 전체가 보이게 촬영해 주세요.',
  builtin_closet: '붙박이장/옷장 겉면·손잡이·내부(열 수 있으면)를 촬영해 주세요.',
  door: '방문과 문틀·손잡이를 함께 촬영해 주세요.',
  toilet: '변기 전체와 변기 뒤·배수구 주변을 촬영해 주세요.',
  sink: '세면대·수전·거울 아래가 보이게 촬영해 주세요.',
  shower_bath: '샤워부스/욕조 바닥·벽·배수구를 촬영해 주세요.',
  drain: '배수구와 주변 바닥·타일을 가까이 촬영해 주세요.',
  exhaust_fan: '환풍기와 주변 천장·벽을 촬영해 주세요.',
  railing: '난간 전체와 바닥 연결부를 촬영해 주세요.',
  washer_area: '세탁기 주변 바닥·벽·배수구를 촬영해 주세요.',
};

export function getInspectionCaptureHint(params: {
  itemKey: string;
  label: string;
  areaLabel: string;
  phase?: 'BEFORE' | 'AFTER';
}): string {
  const keyHint = HINTS[params.itemKey];
  const subject = `「${params.areaLabel} › ${params.label}」`;
  if (params.phase === 'AFTER') {
    if (keyHint) {
      return `${subject} — 청소 후 상태가 보이도록, 같은 각도로 촬영해 주세요.`;
    }
    return `${subject} — 청소 후 깨끗한 상태가 잘 보이도록, 해당 부위 전체와 모서리·틈새를 함께 촬영해 주세요.`;
  }
  if (keyHint) {
    return `${subject} — ${keyHint}`;
  }
  return `${subject} — 청소 전 상태가 잘 보이도록, 해당 부위 전체와 모서리·틈새를 함께 촬영해 주세요.`;
}
