# RoleQA — 선점·이중 호출 (코드 추적)

DB 미적용이라 HTTP 실호출은 하지 않았다.

| 시나리오 | 결과 |
|----------|------|
| A가 번호로 신청 후 반려, B 기본 브랜드 가입 | A는 `REJECTED`라 B를 막지 않는다. 유니크가 업체별로 갈라져 B 행을 만들 수 있다. B만 `callBarobillSignup`을 탄다. |
| 승인 동시 2회 | 한 건만 `PROCESSING` 선점 count 1. 나머지는 바로빌 전에 `이미 처리 중`. |
| 본사 기존 기능 | 접수 pin, 마케터 집계, 스케줄 취소 선반 코드를 건드리지 않았다. `mod_cashbill`은 그대로 Standard부터. |

추가: 10분 넘은 `PROCESSING`은 화면 `확인 필요`. `CheckCorpIsMember`만 호출하고 `RegistCorp`는 자동으로 다시 하지 않는다.
