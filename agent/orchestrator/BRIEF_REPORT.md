# 바로빌 현금영수증 Phase 2

작업 폴더 `feat/barobill-cashbill`. 커밋·푸시·staging 마이그레이션은 하지 않았다.

1. 테스트 업체 `barobill-test`만 생성. Standard, 사업자(등록), 서비스브릿지 사업자번호. 다른 업체는 그대로.
2. 관리자 전용 메뉴 이름은 계산서 연결. 경로 `/admin/team-leaders/cashbill`.
3. 서비스접수 견적서 아래 영수증 → 현금영수증 `/admin/inquiries/receipts/cashbill`, 세금계산서 `/admin/inquiries/receipts/taxinvoice`(준비 중).
4. 접수 상세 견적서 칸 아래 현금영수증. 예약금·잔금·전체, 카드금액 제외, 발급·취소 각 22원.
5. Free는 자물쇠 Standard부터. 미연결은 안내와 계산서 연결로 가기만. 연결 후 발급.
6. 간이과세자(`2`)는 발급 차단. 파트너 잔액 `-26006` `-26011`은 업체 지갑에서 빼지 않고 플랫폼에 보류 알림.

주의: 마이그레이션 `20261028140000_cashbill_issue`는 적용 전 정지. 발급→조회→취소 실호출은 그 다음이다. 세금계산서 메뉴는 이번 범위 밖.

리포트: `agent/orchestrator/reports/packs/2026-10-28-barobill-cashbill/`
