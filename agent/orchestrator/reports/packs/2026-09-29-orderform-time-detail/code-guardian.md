# CodeGuardian — 구체적 시각 목록

## 원인
발급 화면은 양식 `preferredTime.options`면 어떤 값이든 시간대로 인정했다.
구체적 시각 목록은 `오전|오후|사이청소` **글자 그대로**일 때만 채웠다.
표시 문구·공백·유니코드가 다르면 셀렉트만 보이고 옵션이 0개였다.
조율은 원래 목록이 없는데도 빈 셀렉트를 그렸다.

## 수정
- `resolvePreferredTimeSlotForDetail` — trim·NFC·라벨/엑셀 표기 → 4슬롯
- `getPreferredTimeDetailSelectOptions` — 맞춘 뒤에 목록
- 조율·미해결 → 빈 셀렉트 대신 안내
- 서버 `isAllowedPreferredTimeDetail`도 동일하게 맞춤
- `ChoiceAndAreaSteps` `isOrderTimeSlotValue` import 복구

## 검증
- `client` `tsc -b --noEmit` 통과
- 슬롯 해석 스크립트: 오전 3 / 오후 1 / 사이 7 / 조율 0 / 라벨도 동일
- 서버 tsc는 워크트리 Prisma 불일치(기존). 이번 파일과 무관

## 회귀
- 사이청소만 구체적 시각 필수 유지
- 송신 접수·share 상태 미변경
