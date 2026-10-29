# BRIEF — 플랫폼 메뉴 정리 (Phase 1–2)

- 작업지시서만 `staging`에 푸시했다. 커밋 `2d469d36`. 화면 변경은 `feat/platform-reorg` 작업 트리에만 있고 푸시하지 않았다.
- 왼쪽 메뉴 6묶음: 오늘 할 일, 업체, 매출·수납, 부가서비스, 마케팅·고객, 설정.
- 이름: 이용료 청구, 입금 내역, 수기 카드결제, PG 수수료, 계산서(바로빌), DB 마켓.
- 입금 계좌·연체는 설정 탭. 저장은 예전과 같은 API.
- 오늘 할 일은 기존 확인 화면으로 가는 목록이다. 건수 배지 API는 없다.
- 업체 상세 탭: 개요, 요금·청구, 기능, 부가서비스, 사업자·계정, 위험. `?tab=`
- 기존 플랫폼 주소는 유지. 스키마와 저장 로직은 그대로.
- 클라이언트 타입 검사는 통과. 브라우저 클릭 확인은 하지 못했다.
- Phase 3은 시작하지 않았다. 화면을 본 뒤 지시가 오면 한다.

## 확인할 경로

- 메뉴: `/platform/inbox`, `/platform/billing`, `/platform/settings/bank`
- 업체: `/platform/tenants?plan=free` · `plan=standard` · `plan=premium` 에서 한 곳씩 연 뒤 `?tab=billing|features|addons|account|danger`
