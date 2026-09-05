# CodeGuardian — 작성 설정 구현

- 공통: `shared/orderFormFillRules.ts` + `server/src/lib/orderFormFillRules.ts`
- 저장: `OrderFormConfig.issueFillRules` (migrate `20260904170000`)
- 발급: 면적 마케터+필수 시 서버 400
- 고객: 면적 질문 숨김, 공란이면 상담 안내
- UI 분리: `IssueFormSectionTabs`, `IssueFillRulesSettingsPanel` — 페이지 비대화
- tsc client/server 통과
