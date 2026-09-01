FROM curlimages/curl:8.5.0

# Railway Cron Job: 컨테이너 기동 → 해피콜 FCM + 일정확인 알림톡 cron POST → 종료
# Variables: CRON_BASE_URL(끝 / 없음), HAPPY_CALL_CRON_SECRET, (선택) ALIMTALK_CRON_SECRET
CMD ["/bin/sh", "-c", "curl -sf -X POST \"${CRON_BASE_URL}/api/admin/cron/happy-call-reminders\" -H \"Authorization: Bearer ${HAPPY_CALL_CRON_SECRET}\" && curl -sf -X POST \"${CRON_BASE_URL}/api/admin/cron/alimtalk-schedule-d2\" -H \"Authorization: Bearer ${ALIMTALK_CRON_SECRET:-$HAPPY_CALL_CRON_SECRET}\""]
