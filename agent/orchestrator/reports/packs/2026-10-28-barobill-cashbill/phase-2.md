# Phase 2 — 현금영수증 발급

## CodeGuardian

- 발급·취소는 `tenantId`와 접수 소유 확인 후 진행. 다른 업체 접수는 403.
- Free는 `requireFeature('mod_cashbill')` 403.
- 관리 키는 회원사+키 유니크. 같은 요청은 다시 바로빌에 넣지 않고 상태를 본다. 처리 중은 409 `이미 처리 중`.
- 발급·취소 모두 22원 선차감, 바로빌 실패 시 환급. 파트너 잔액 `-26006` `-26011`도 환급하고 업체 지갑에 남기지 않는다.
- 마이그레이션 `20261028140000_cashbill_issue`는 파일만 있고 staging에는 적용하지 않았다.

## DesignPulse

- 서비스접수 왼쪽 메뉴, 견적서 그룹 아래에 영수증 그룹. 현금영수증과 세금계산서(준비 중).
- 접수 상세는 견적서 칸 바로 아래 현금영수증 칸. 번호 있는 섹션 순서에는 넣지 않았다.
- 목록은 기간·상태·브랜드, PC 표와 모바일 카드, 페이지 분할. 금액은 오른쪽 정렬.
- 미연결은 안내와 계산서 연결로 가기 버튼만. Free는 기존 자물쇠 `Standard부터`.

## ConfigCurator

- 메뉴 표시 이름 계산서 연결. 경로 `/admin/team-leaders/cashbill` 유지.
- 현금영수증 `/admin/inquiries/receipts/cashbill`, 세금계산서 `/admin/inquiries/receipts/taxinvoice`. moduleId `mod_cashbill`.
- 끄기 설정은 없다. 상태 색은 레지스트리에 적었다.

## MarketingAgency

- `agent/marketing` 메뉴 이름, 클릭 경로, 목록 설명, 상태 색 hex를 갱신했다.
- 세금계산서 그룹은 만들지 않았다.

## PlatformOps

- `mod_cashbill`은 Standard 이상. Free 메뉴는 잠금.
- 테스트 업체 `barobill-test`만 새로 만들었다. 플랜 standard, 유형 registered_business, 사업자번호는 서비스브릿지. 다른 업체는 변경하지 않았다.
- 바로빌 가입 API는 호출하지 않았다. 연결완료 아이디는 넣지 않았다.
- 파트너 잔액 보류는 플랫폼 현금영수증 회원 화면 상단에 업체명과 코드만 보인다.

## RoleQA

정적 확인만 했다. 서버·클라이언트 타입 검사는 통과했다.

| 화면 | 기대 |
|------|------|
| Free | 메뉴 자물쇠 Standard부터. 목록을 열면 잠금 안내. |
| Standard 미연결 | 메뉴와 접수 칸은 보임. 문구는 계산서 연결을 먼저 해주세요. 버튼은 계산서 연결로 가기. |
| 연결 완료 | 예약금·잔금·전체, 카드금액 제외, 발급·전액 취소, 목록의 국세청 상태. |

발급 → 상태조회 → 취소 1건은 하지 못했다. 새 테이블이 staging에 없고, 적용 전에 멈추라는 지시가 우선이다. 코드도 아직 staging에 배포되지 않았다.
