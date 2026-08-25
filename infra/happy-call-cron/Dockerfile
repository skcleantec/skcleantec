FROM curlimages/curl:8.5.0

# Railway Cron Job: 컨테이너 기동 → curl 1회 → 종료
# Variables: CRON_BASE_URL(끝 / 없음), HAPPY_CALL_CRON_SECRET
CMD ["/bin/sh", "-c", "curl -sf -X POST \"${CRON_BASE_URL}/api/admin/cron/happy-call-reminders\" -H \"Authorization: Bearer ${HAPPY_CALL_CRON_SECRET}\""]
