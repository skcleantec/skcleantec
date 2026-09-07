# CodeGuardian — 회귀·연관 파일

**핵심 리스크:** `OrderFormPage` / `orderFormFieldVisibility.isStdFieldOn` — `tpl.isDefault`이면 전부 true. 이걸 통째로 바꾸면 기본 양식에서 방 개수·특이사항 등이 사라질 수 있다. **섹션 토글 키만** 예외 (`photos`, 선택 시 `professionalOptions`).

**연관**

| 층 | 파일 |
|----|------|
| 카탈로그 | `server/src/modules/orderform-templates/systemFields.ts` |
| 양식 UI | `client/src/pages/admin/AdminOrderFormTemplatesPage.tsx` (페이지 800줄 근접 — 토글은 새 컴포넌트로 추출) |
| 미리보기 | `client/src/components/admin/OrderFormTemplatePreview.tsx` |
| 고객 | `OrderFormPage.tsx`, `orderFormCustomerSteps.ts`, `OrderFormPhotoSection.tsx` |
| 작성 규칙 | `shared/orderFormFillRules.ts` — 이번엔 키 추가 없음 |
| API | `orderform.routes.ts` 토큰 사진 POST |

**금지**

- 페이지에 100줄+ JSX 추가. `OrderFormSectionToggles.tsx` 같은 모듈.
- 기본 양식 전체 필드를 템플릿 목록 의존으로 바꾸기.
- 업로드 경로를 클라만 숨기고 서버는 열어둠.

**검증:** client/server `tsc`. 마이그레이션 없음. 기본 양식 photos 백필은 스크립트 또는 저장 시 idempotent upsert.
