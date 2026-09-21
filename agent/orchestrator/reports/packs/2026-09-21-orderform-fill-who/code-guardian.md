# CodeGuardian — 발급 칸 누가 적나

- 배지·범례는 `OrderFormIssueFillWho.tsx`. `OrderFormPage`는 라벨에만 붙임.
- 손님 공개 폼(`!isEditor`)에는 배지·알림톡 안내 없음.
- `describeIssueFillWho`는 shared + server lib 동기화.
- 작성 설정 로직(`marketerMustFillAtIssue`) 재사용. 새 API 없음.

## 판정
| 항목 | 등급 |
|------|------|
| 페이지 거대화 | OK — 신규 UI 분리 |
| 고객 화면 오염 | OK |
| tenant | 해당 없음 |
