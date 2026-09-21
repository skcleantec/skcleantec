# CodeGuardian — 선입력 확인

- `skipLocked: false` — 선입력 칸을 질문에서 빼지 않음.
- 잠금(`lockKey` / space count > 0)은 그대로. 손님은 확인만.
- 날짜·시간 칩/선택도 잠기면 비활성. 과거 날짜 지우기 이펙트는 잠긴 날짜에 안 탐.
- 스키마·API 변경 없음. client tsc 통과.
