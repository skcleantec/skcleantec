# CodeGuardian — 작성 규칙 v2

**일시:** 2026-09-04 16:58 KST

## 이전 플랜에서 버린 것

- `?tab=fillPolicy` (목록·후속과 같은 급 탭)
- 칸당 `MARKETER_REQUIRED` / `CUSTOMER_OK` 두 값만

## 데이터

칸마다 `{ customer: boolean, marketer: boolean, required: boolean }`  
저장: `OrderFormConfig.issueFillRules` JSON, `tenantId` unique.  
헬퍼 한곳: `shared/orderFormFillRules.ts` — 클라·서버 동일.

## 체크 해석 (세 칸 독립, 겹침 허용)

역할 = 고객·마케터. **둘 다 꺼짐 = 누구나**(둘 다 작성 가능).

| 고객 | 마케터 | 필수 | 누가 적나 | 언제 막나 |
|------|--------|------|-----------|-----------|
| - | - | - | 누구나 | 안 막아도 됨 |
| - | - | ✓ | 누구나 | **제출 직전** 값이 없으면 거부 (발급은 비워도 됨) |
| ✓ | - | - | 고객만 | 선택 |
| ✓ | - | ✓ | 고객만 | 고객 제출 시 필수. 발급 때 마케터는 못 적음 |
| - | ✓ | - | 마케터만 | 선택. 고객 화면 숨김 |
| - | ✓ | ✓ | 마케터만 | **발급 시 필수**. 고객은 수정·추측 불가 |
| ✓ | ✓ | - | 둘 다 | 선택 |
| ✓ | ✓ | ✓ | 둘 다 | 제출 직전 값 필수 (발급 때 채워도 됨) |

**면적 기본:** 마케터 ✓ + 필수 ✓. 공급·전용·평수는 **한 세트**.

**누구나 작성**이면 마케터가 채워도 고객이 고칠 수 있음(잠금 없음).  
**마케터만**이면 값이 있어도 고객 잠금·질문 숨김.  
레거시 링크 + 면적 공란 + 마케터만: 고객이 공급/전용을 고르게 하지 않음. 제출 거부 + 상담 안내.

## 발급 화면

- 긴 폼을 **번호 제목 탭**으로 자름 (1 성함 … 12 사진 + 전문시공).
- URL: `?issueSection=area` 등, 설정은 `?issueView=settings` (상위 `tab=issue` 유지).
- 건별 「고객 작성」(`dateByCustomer`)은 **청소날짜·시간대 행 설정으로 흡수**. 건마다 체크 제거.

## 구현 위치

- UI: `IssueFormSectionTabs` + `IssueFillRulesSettingsPanel` (`components/admin/order-issue/`)
- 가드: 발급 create / 고객 submit / `orderFormFieldVisibility.ts`
- 양식 fillMode와 충돌 시 **이 규칙이 이김**

## 기본값 권장

- 면적: 마케터+필수
- 지금 위저드가 강제하는 칸(성함·주소·연락처 등): **필수만** (누구나, 제출 때 채움)
- 사진: 체크 없음
