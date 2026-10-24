# Phase 3 — 잠금 메뉴

## AppScout
클릭한 순간에만 안내. 상단은 상위 메뉴 잠금만. 본문은 카드 한 장.

## PlatformOps
- 판정은 `getModuleVisibility`. 서버 `requireFeature` 403은 그대로.
- 플랜 변경·기능 저장·플랜 기준 초기화 후 `tenant:capabilities`로 `/auth/me`를 다시 읽게 함.
- 텔레CRM은 어떤 플랜 목록에도 없어 잠금이 아니라 숨김.

## DesignPulse
자물쇠 `line-md:lock`. 상단 배지 amber-200. 사이드·휴대폰 하위는 amber-800 / amber-50. 본문 버튼 slate-900.

## ConfigCurator
표시 신호 `nav.planLock`. 사용자가 끄는 설정은 없음. 업체가 끈 기능은 이 배지가 아니라 메뉴에서 빠짐.

## MarketingAgency
CATALOG 3.4, CHANGELOG, menus/admin.md.

## CodeGuardian
GNB·사이드·FeatureGate가 같은 판정을 씀. 메시지 화면만 잠금 안내가 없어 이번에 감쌈.

## RoleQA 매트릭스
| 메뉴 | Free 1인 | 유료 1인(Standard, 배정 끔) | Standard 본사 | Premium 본사 |
|------|----------|------------------------------|---------------|--------------|
| 메시지 | 잠금 Standard부터 | 켜짐(플랜에 있고 기본 켜짐) | 켜짐 | 켜짐 |
| 광고비 | 잠금 Standard부터 | 켜짐 | 켜짐. 업체가 끄면 숨김 | 켜짐. 끄면 숨김 |
| C/S | 사이드 잠금 Standard부터 | 켜짐 | 켜짐. 끄면 숨김 | 켜짐 |
| 월정산표 | 사이드 잠금 Standard+부터 | 사이드 잠금 Standard+부터 | 사이드 잠금 Standard+부터 | 켜짐. 끄면 숨김 |
| 문의내역 | 사이드 잠금 Standard+부터 | 사이드 잠금 Standard+부터 | 사이드 잠금 Standard+부터 | 켜짐. 끄면 숨김 |
| 가계부 | 상단 표시 | 상단 표시 | 없음(본사) | 없음 |

- 잠금 클릭은 안내 카드. 대시보드로 보내지 않음.
- 업체가 끈 기능은 숨김.
- 플랜이 바뀌면 웹소켓 `tenant:capabilities`로 `/auth/me`를 다시 읽어 잠금을 푼다. 실기기 확인은 배포 후.
