# PlatformOps — 안내사항 브랜드별

## Feature id
- 기존 `core_inquiries` (발주서설정). **새 `mod_*` 없음.**

## Catalog status
- GNB·플랜 변경 없음. 안내사항은 이미 발주서설정 패널.

## Gaps
- 플랫폼에서 테넌트별 「브랜드 안내 덮어쓰기」 사용 여부 집계는 없음. 필요 시 `OperatingCompany.config`에 키 존재 여부로 나중에 세면 됨.

## Per-tenant ops
- 켜기: 해당 없음 (코어).
- 브랜드가 1개면 UI는 공통만 보여도 됨 (브랜드 탭 숨김 또는 비활성).

## Billing impact
- 없음.

## Recommended
- 플랜 게이트 추가하지 말 것.
