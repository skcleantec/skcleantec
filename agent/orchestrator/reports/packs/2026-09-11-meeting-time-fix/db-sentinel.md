# DbSentinel — 크루 일정 tenant

- `buildCrewFieldSchedule` `inquiry.findMany`에 `tenantId: group.tenantId` 추가.
- 그룹 `select`에 `tenantId` 포함.
- 이름 조회는 `tenantActiveTeamMemberWhere` AND `name`/`nameTh`.
- Prisma 스키마·마이그레이션 변경 없음.
- 접수 원본을 취소하지 않음. share/REVOKED와 무관.
