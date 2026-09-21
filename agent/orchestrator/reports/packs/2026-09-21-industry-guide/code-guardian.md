# CodeGuardian — 발주서별 안내

- 공개 안내 조회는 `templateId` + `tenantId`. id만으로 다른 업체 양식을 열지 않음.
- 저장 API `PUT /:id/guide` 는 로그인 테넌트 스코프.
- 위약 % 는 브랜드 토큰 유지. 양식 본문에 % 숫자를 박지 않음.
- schema + migration `20260921093000_order_form_template_guide` 동반.
- server/client `tsc --noEmit` 통과.
