# DesignPulse — 이용 순서 막대

## Research notes
- 페이지 배경 `#edf0f5` 위 `bg-slate-50`는 거의 안 보임
- 발주서 도움말 흐름도 톤(slate/sky/amber/emerald/violet) 재사용
- GNB `blue-600`은 본문에 쓰지 않음

## PC
- 단계 칩 가로 한 줄 + `›` 구분
- 활성 칩은 해당 톤 채움, 비활성은 `*-50` 틴트
- 팁 박스가 활성 톤과 맞춤

## Mobile / Team
- 칩 overflow-x 유지, `›` 는 `sm+` 만
- `/team` 미적용(기존과 동일, 관리자 전용)
- 접힌 막대도 그라데이션 유지

## Recommendations
1. 적용 완료 — 과도한 팔레트 하드코딩 없이 역할 톤만 사용

## Files touched
- `client/src/components/admin/workflow-guide/StaffWorkflowGuideBar.tsx`
- `client/src/components/admin/workflow-guide/workflowGuideSteps.ts`
- `agent/config-curator/display-indicator-registry.json`
