# 구현 — 고객 발주서 사진첨부 ON/OFF

**설정:** 서비스접수 → 발주서 양식 → 고객에게 보일 섹션 → 현장 사진 첨부
**저장:** 템플릿 필드 `systemField=photos`, 끄면 options에 `__section_off__`
**기본 양식:** 필드 없으면 켜짐(레거시). 끄면 필드를 만들고 off 표시.

건드린 곳: `OrderFormSectionToggles.tsx`, `orderFormSectionToggles.ts`, `isStdFieldOn`, `templateHasSystemField`, 사진 POST 가드, 도움말·레지스트리.
