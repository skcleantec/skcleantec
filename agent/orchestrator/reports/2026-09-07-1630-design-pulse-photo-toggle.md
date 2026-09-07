# DesignPulse — 섹션 토글 UI

**패턴:** SaaS 폼 빌더의 optional section switch (Typeform/Google Forms 「섹션 사용」과 같음). 항목 리스트에 가짜 TEXT 필드를 넣지 말고, 구성 위 전용 카드.

**레이아웃**

- 카드: `rounded-lg border border-slate-200 bg-white p-2 sm:p-3`
- 한 줄: 왼쪽 「현장 사진 첨부」+ HelpTooltip, 오른쪽 스위치
- 보조 한 줄: `text-fluid-2xs text-slate-500` — 「고객 발주서에 사진 올리는 칸을 보여 줍니다.」
- 기본 양식에도 같은 카드. 필수 코어(이름·주소 등)는 이 카드에 넣지 않음.

**토큰**

- Primary는 스위치 on = `bg-slate-900` (가이드 CTA). `bg-blue-600` 금지.
- hover / focus-visible ring / disabled 필수.
- `text-fluid-xs` / `text-fluid-2xs`. 임의 `text-[10px]` 금지.

**반응형**

- PC·모바일 동일 1줄. 표/카드 분기 불필요.
- 고객 미리보기(`OrderFormTemplatePreview`)는 토글 OFF면 사진 블록 숨김(이미 `systemField === 'photos'` 기준).
