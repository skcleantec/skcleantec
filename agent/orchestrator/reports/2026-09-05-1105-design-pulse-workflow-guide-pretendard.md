# DesignPulse — 이용 순서 · Pretendard

## Research notes
- 2026 shadcn onboarding stepper: 단색, 번호 원, 연결선, 활성만 강조
- 한국 SaaS(토스·flex): Pretendard Variable
- 직전 다색 그라데이션은 `#edf0f5` 위에서 촌스러움

## PC
- 흰 카드 + slate-200 보더 + 아주 약한 그림자
- 활성 칩만 slate-900, 나머지는 slate-500
- 안내 문구는 왼쪽 2px 라인, 색 박스 없음

## Mobile / Team
- 칩 가로 스크롤 유지
- `/team` 미적용(기존)

## Recommendations
1. 적용 완료. 전역 폰트 전환은 로그인·목록에도 같이 반영됨

## Files touched
- `client/index.html`, `client/src/index.css`, `client/tailwind.config.js`
- `client/src/components/admin/workflow-guide/*`
- `docs/UI_DESIGN_GUIDE.md` §3
