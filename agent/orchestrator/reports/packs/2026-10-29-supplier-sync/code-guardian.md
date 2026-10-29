# CodeGuardian — 공급자 빈 값 덮어쓰기

- 저장 경로는 `tenantId` 조건을 유지한다. 다른 브랜드 id는 기존 403.
- 빈 상호·대표자·주소·안내 문구는 `BarobillMember`와 가입 사업자정보에 쓰지 않는다.
- 사업자정보 저장은 상호가 비어 있으면 설정 저장 전에 400.
- 발행 409와 배너는 비어 있는 칸 이름만 말한다.
- 스키마 변경 없음.
- `npx tsc -b --noEmit`(client), `npx tsc --noEmit`(server) 통과.
