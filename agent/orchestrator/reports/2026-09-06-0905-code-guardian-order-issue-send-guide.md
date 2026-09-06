# CodeGuardian — 발주서 보내기 안내

**일시:** 2026-09-06 09:05 KST

## 파일

- `workflowGuideSteps.ts` · `StaffWorkflowGuideDetail.tsx`
- `orderIssueHelpActions.tsx` · `OrderIssueHelpUiParts.tsx` · `OrderIssueHelpPreview.tsx`
- `scripts/help-content/admin-service-inquiries.mjs` → `help/data.json`

## 점검

- [x] 실제 버튼명: 「발급 및 링크 생성」「알림톡 발송」「메시지 복사」「링크 복사」
- [x] 페이지에 JSX 100줄 추가 없음
- [x] `npx tsc -b --noEmit` (client) 통과
- [x] `node scripts/build-help-data.mjs` 통과

BLOCKER 없음.
