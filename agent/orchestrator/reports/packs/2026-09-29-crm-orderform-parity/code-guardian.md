# CodeGuardian — CRM 발주서 경로

## 동일 (메인 발급과 같음)
- 화면: `CrmOrderIssueDrawer` → `OrderIssueInlinePanel` → `OrderFormPage` (`isCreate`)
- 불러오기: `GET /issue-form` (`orderform.issue`)
- 저장: `createOrderForm` + `saveOrderFormPrefill` (`handleCreateAndPrefill`)
- 양식·브랜드·유입·대기접수 연결: 인라인 패널이 발급 페이지와 같은 필드
- 시간대·구체적 시각: 같은 셀렉트·같은 resolve 함수 (운영 `6de869d9` 포함)

## CRM만 있는 것
- `telecrm=1` → 양식에 `crmQuoteBreakdown` 칸 보장
- `crmSeed`: 이름·전화·주소·희망일·방/화장실/베란다·총액·예약금·전문시공·견적 문구
- 발급 후 `POST .../link-inquiry`로 견적↔접수 연결 (실패해도 발급은 유지)

## 의도적 차이
- CRM 접수칸(`CrmIntakeFormSnapshot`)에 **시간대·구체적 시각 없음** → 시드에도 없음
- 청소 종류: 발급(`isEditor`)에서는 숨김 — 고객 작성 (발급 페이지와 동일)
- Android 텔레CRM: 발급 UI 없음, lookup **발주서 요약**만

## 회귀
- 멀티테넌트: issue-form·create 모두 `tenantId`
- share/스케줄 상태와 무관
