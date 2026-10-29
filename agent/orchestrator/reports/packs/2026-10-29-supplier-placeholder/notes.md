# 공급자 안내 문구 · 모바일 버튼

- 저장 경로: 일회성 생성 스크립트 → `tenant_signup_businesses` → `registerCashbillMember`가 `barobill_members`로 복사.
- 검증: `isBlankSupplierField`. 발행 409 문구는 기존 문장 유지.
- 모달 클래스 `modal-mobile-safe-overlay`가 있으면 관리·팀 모바일 우측 버튼을 렌더하지 않음.
- staging SELECT만. 같은 문구 다른 업체 0건. UPDATE 없음.
