-- noreply 안내: 고객센터 대신 해당 업체로만 연락 (사용자 저장 전 기본 행만)
UPDATE "platform_email_templates"
SET
  "noreply_notice_html" = $html$<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b">본 메일은 발신 전용 주소(<strong style="color:#475569">noreply</strong>)로 발송되었으며 <strong style="color:#0f172a">회신되지 않습니다</strong>.</p><p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">문의·일정 변경 등은 <strong style="color:#0f172a">해당 업체</strong>로만 연락해 주세요.</p>$html$,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "updated_by_email" IS NULL;
