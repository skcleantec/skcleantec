# CodeGuardian — 일정확인 0건

운영 cron이 D2를 안 부름. job(`runAlimtalkScheduleD2Job`)·라이선스 게이트는 dry-run에서 후보 7건.  
`&&`는 해피콜 실패 시 D2를 건너뛰므로 `;` 로 분리. 공유 DB migrate 없음.
