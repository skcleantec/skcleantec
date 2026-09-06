# 일정 확인 알림톡 0건 — 정밀검사

**일시:** 2026-09-06 10:20 KST

## 결론

**0건 = 미발송이 맞다.** 템플릿·솔라피·발주서 경로 문제가 아니라, **운영 자동 호출이 일정 확인 API를 한 번도 치지 않았다.**

## 타임라인

| 날짜 | 내용 |
|------|------|
| 2026-08-21 | 발주서 알림톡 템플릿 (수동/제출 직후 — 화면 목록과 무관) |
| 2026-08-27 | `CBISEO_CUST_SCHEDULE_D2` 코드·cron 라우트 |
| 2026-09-01 | 발송 시각 낮 12시, Railway cron 문서에 D2 연동 |
| 2026-09-01 | 운영 cron `hearty-expression` 배포 — **해피콜 curl만** 설정됨 |
| 이후 ~5일 | 해피콜은 15분마다 성공. 일정 확인 API 로그 **0** |

## 교차 증거

1. **운영 cron startCommand (수정 전)**  
   `POST .../happy-call-reminders` **만**. `alimtalk-schedule-d2` 없음. 이미지 `curlimages/curl`, config file 없음.
2. **API 로그 48~72h**  
   `[happy-call-reminders]` 있음. `[alimtalk-schedule-d2]` 없음. `CBISEO_CUST_SCHEDULE_D2` 없음.
3. **GitHub Actions** (`main`, 15분)  
   `CBISEO_CRON_BASE_URL` / cron secret **공백** → `Skip` 후 `exit 0` (성공으로 보임). 실호출 없음.
4. **dry-run** (시각 가드 생략, 발송 없음)  
   `http=200` · 오늘 기준일 `2026-09-06` · `candidates=7` · `sent=7`(dry-run) · `failed=0`  
   → API·라이선스·위약일 계산은 후보를 잡을 수 있음.

## 조치 (운영)

- `hearty-expression` startCommand에 일정 확인 curl 추가. 해피콜 실패와 분리(`;` ).
- 다음 15분 tick부터 API가 호출됨. **실제 고객 발송은 낮 12시 KST 이후.**
- 레포 `infra/happy-call-cron/railway.json` · 문서도 `;` 로 맞춤.

## 관리자 화면

「최근 일정 확인 알림 발송」은 `CBISEO_CUST_SCHEDULE_D2`만 센다. 발주서가 잘 나가도 여기는 0일 수 있다. 이번 0건의 **직접 원인**은 그 혼동이 아니라 **cron 미호출**.
