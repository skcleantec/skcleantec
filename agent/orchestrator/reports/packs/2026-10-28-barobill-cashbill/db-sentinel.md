# DbSentinel — 사업자번호 선점

- 유니크는 `(env, tenantId, corpNum)`. 다른 업체의 같은 번호 행을 막지 않는다.
- 다른 업체 409는 `ACTIVE`·`LINK_REQUIRED`만. `PENDING_REVIEW`·`REJECTED`·`FAILED`·`PROCESSING`은 신청을 막지 않는다.
- 승인 직전에도 같은 조건을 다시 보고, 걸리면 `PROCESSING`을 `PENDING_REVIEW`로 되돌린 뒤 바로빌을 호출하지 않는다.
- 플랫폼 목록의 다른 업체 이름은 업체명과 상태만. 전화·이메일은 내려주지 않는다.
- 테넌트 가입 API는 브랜드 id를 읽은 뒤 `tenantId`가 다르면 403. 쓰기는 `updateMany`에 `tenantId`를 넣는다.
- 마이그레이션 `20261028120000_barobill_member` 한 파일. staging 적용 안 함.
