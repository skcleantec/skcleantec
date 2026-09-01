# Maestro — 모바일 마케터 전화 오동작 수정 (2026-09-01)

## 증상

- **서비스접수 목록**·**스케줄**에서 접수 상세 연 뒤 **전화** 시, 선택한 건이 아니라 **바로 윗줄 접수** 고객에게 연결된다는 제보.

## 원인 (CodeGuardian)

1. **접수 목록 모바일 카드**: `tel:` `<a>`가 `role="button"`(상세 열기) **안쪽**에 있어 iOS/WebView에서 터치·고스트 클릭이 인접 행과 겹칠 수 있음.
2. **상세 모달(`ScheduleInquiryDetailModal`)**: 헤더에 **전화 버튼 없음** → 상세 연 후 사용자가 목록 우측 「전화」 위치를 다시 누르면, 모달 뒤 목록의 **다른 행 tel 링크**가 눌릴 수 있음 (스크롤·좌표 어긋남 → 「윗줄」).
3. **스케줄 목록**: tel 버튼 자체는 없으나, 동일 상세 모달을 쓰므로 (2)와 동일 UX.

## 수정

| 파일 | 변경 |
|------|------|
| `client/src/components/admin/InquiryCustomerCallButton.tsx` | **신규** — `button` + `pointerdown`/`click` 분리, `tel:` 직접 네비게이션, 행 클릭 전파 차단 |
| `client/src/pages/admin/AdminInquiriesPage.tsx` | 전화 버튼을 상세 클릭 영역 **밖**으로 이동; `editItem` 시 목록 `pointer-events-none` |
| `client/src/components/admin/ScheduleInquiryDetailModal.tsx` | 헤더에 **전화** 버튼 추가 (`editForm.customerPhone` 기준) — 접수·스케줄 **동일 모달** |

## 검증

- `cd client && npx tsc -b --noEmit` — **통과**

### RoleQA — 수동 스모크 (모바일 또는 DevTools 모바일 뷰)

1. **접수 목록**: 연속 3건 카드에서 각각 **전화** → 다이얼러 번호 = 해당 카드 `customerPhone`.
2. **접수 목록**: 2번째 카드 **상세** → 헤더 **전화** → 2번째 번호 (1번째 아님).
3. **스케줄**: 임의 일정 **상세** → 헤더 **전화** → 해당 접수 번호.
4. 상세 모달 열린 상태에서 목록 **전화** 탭 불가(`pointer-events-none`) 확인.

## CRM

- 사용자 요청: **TeleCRM은 사용 중이므로 변경 없음** (별도 감사만 유지).

## 배포

- 스테이징 반영 후 마케터 실기기 1회 확인 권장.
