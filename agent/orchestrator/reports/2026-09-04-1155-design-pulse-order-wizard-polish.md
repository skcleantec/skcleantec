# DesignPulse — 고객 발주서 위저드 다듬기

## Research notes
- 카카오·뱅킹 원퀘스천: CTA는 하단 고정, 법적·사업자 정보는 CTA 아래.
- 질문 타이틀 → 본문 → 칩 순 페이드업이 슬라이드만보다 고급스러움.

## PC
- max-w-lg 유지. 하단 바가 두꺼워져도 본문 여백으로 가리지 않음.

## Mobile / Team
- 공개 고객 폼. 키보드 inset 유지, 하단 예약 여백 200px.
- prefers-reduced-motion: 페이드만.

## Recommendations
1. 완료 — 버튼 위 / 회사정보 아래.
2. 완료 — 칩 순차 등장.

## Files touched
- OrderFormCustomerWizard.tsx, wizardUi.tsx, index.css
