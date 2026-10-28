# 바로빌 현금영수증 — staging

브랜치 `feat/barobill-cashbill`를 staging에 합친다. `main`은 올리지 않는다.

1. 회원사 마이그레이션 `20261028120000_barobill_member`만 staging DB에 적용.
2. 기본 브랜드는 바로 가입, 추가 브랜드는 검토 후 승인. 바로빌 호출 전에 처리 중으로 선점.
3. 화면: 관리자 전용 → 증빙 발급 설정, 플랫폼 → 결제 관리 → 현금영수증 회원.
4. 잠금 메뉴 자물쇠 수정(staging)을 함께 유지.

리포트: `agent/orchestrator/reports/packs/2026-10-28-barobill-cashbill/`
