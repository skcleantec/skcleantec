# Phase 2 — 업체 상세 6탭

에이전트 순서: DesignPulse → ConfigCurator, CodeGuardian → PlatformOps → RoleQA.

## 한 일

- 탭은 개요, 요금·청구, 기능, 부가서비스, 사업자·계정, 위험. 주소는 `?tab=`.
- 예전 탭 이름(plan, usage, settings, admins)은 새 탭으로 바뀐다.
- 개요의 설정 점검은 이미 내려온 값과 기존 조회 API로만 채운다.
- 기능 표는 읽고, on/off 저장은 예전 「화면 표시 설정」 토글 그대로다.
- 부가서비스에 이 업체의 PG 연결(끝 4자리)과 바로빌 상태·인증서 유무를 보여 준다.

## 게이트

- 클라이언트 타입 검사 통과.
- 저장 함수는 옮기지 않고 같은 버튼을 남겼다.
- 화면 클릭 확인은 하지 못했다. Free / Standard / Premium 실업체 이름은 이 PC의 DB(localhost)에 없어 적지 않았다.

## 멈춤

사람이 화면을 본 뒤에 Phase 3을 시작한다.
