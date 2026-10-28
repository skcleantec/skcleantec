# 바로빌 현금영수증 — Phase 0·1

브랜치 `feat/barobill-cashbill`. 커밋·푸시·staging migrate 없음. Phase 2 없음.

1. 서버 SOAP 클라이언트(`soap`, TI·CASHBILL·CORPSTATE)와 단가 정책. 클라이언트 번들 소스에 SOAP·인증키 없음.
2. `BarobillMember` 스키마와 마이그레이션 SQL만 추가. DB에는 아직 없음.
3. 관리 「증빙 발급 설정」, 플랫폼 「현금영수증 회원」. `mod_cashbill`은 Standard 이상. Free는 잠금.
4. test 호출은 인증키가 로컬·Railway에 없어 잔액·회원조회 전에 중단. 키는 기록하지 않음.
5. 서버·클라이언트 tsc 통과. 본사·1인 기존 화면 파일은 그대로.

확인할 곳 (migrate 승인 후): 관리자 전용 → 증빙 발급 설정, 플랫폼 결제 관리 → 현금영수증 회원.

리포트: `agent/orchestrator/reports/packs/2026-10-28-barobill-cashbill/`
