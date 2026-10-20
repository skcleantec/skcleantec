# AppScout — 관리자가 팀장별 임금 방식을 한 화면에서 정한다

## 추천 방법
1. 사람을 고른 뒤 급여 주기(월급·일당·비율)와 금액만 보이게 한다. Payroll Panda, Reckon, 1st Money, 매니지 모두 「직원 선택 → 급여 형태 → 금액」이다.
2. 같은 날 여러 건은 일당을 건마다 나눌지, 하루로 모을지를 그 다음에만 보여 준다.
3. 전체 직원 현황은 아코디언·긴 폼 대신 짧은 목록으로 두고, 줄을 누르면 위 선택이 바뀌게 한다 (ADP Roll: 공통 정보만 보이게).

## 타 앱 작동방식
| 앱·출처 | 최신 흐름 | 우리에게 쓸 점 |
|---------|-----------|----------------|
| Payroll Panda | 직원 → Employment Details → Salary/Wages Frequency (Monthly/Daily/Hourly) → 금액 | 방식 고른 뒤에만 금액 |
| Reckon Payroll | Pay setup에서 Hourly 또는 Salary | 한 사람씩 |
| 매니지 | 시급·일급·월급 중 하나 | 형태는 한 가지 |
| PocketSuite | 팀원별 fixed / percentage / hourly | 잔금 비율과 같은 축 |

## 모바일 인기 디자인 레퍼런스
| 순위 | 출처 URL | 왜 인기인가 | 가져올 패턴 |
|------|----------|-------------|-------------|
| 1 | https://mobbin.com/explore/mobile/screens/select | 실서비스 셀렉트 모음 | 한 드롭다운으로 사람 선택 |
| 2 | https://mobbin.com/explore/mobile/screens/settings-preferences | 설정 화면 패턴 | 스위치는 맨 위 한 줄 |
| 3 | https://frankstall.one/portfolio/roll-by-adp/ | ADP 모바일 급여, 직원 줄은 짧게 | 아래는 한 줄 요약 표 |

## 하지 말 것
- 팀장마다 폼을 세로로 쌓기
- 회사 급여표와 가계부 임금을 한 화면에서 섞기

## DesignPulse / 구현에 넘길 한 줄
톱니바퀴 한 창: 위 스위치·드롭다운·방식, 아래는 팀장 한 줄 요약. 휴대폰은 표 대신 한 줄 버튼.
