-- 고객 메일: 플랫폼 문의 유도 제거. 청소비서는 고객관리 솔루션, 문의는 담당 업체만.
UPDATE "platform_email_templates"
SET
  "noreply_notice_html" = $html$<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b">본 메일은 발신 전용 주소(<strong style="color:#475569">noreply</strong>)로 발송되었으며 <strong style="color:#0f172a">회신되지 않습니다</strong>.</p><p style="margin:0;font-size:13px;line-height:1.6;color:#64748b"><strong style="color:#334155">청소비서</strong>는 청소 업체의 <strong style="color:#334155">고객관리 솔루션</strong>입니다. 문의사항은 <strong style="color:#0f172a">담당 업체</strong>에 연락해 주세요.</p>$html$,
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "platform_email_templates"
SET
  "footer_html" = $html$<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-collapse:separate">
<tbody><tr><td style="padding:14px 16px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px">
<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#334155">담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.</p>
<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b"><strong style="color:#334155">청소비서</strong>는 청소 업체의 <strong style="color:#334155">고객관리 솔루션</strong>입니다. 문의사항은 <strong style="color:#0f172a">담당 업체</strong>에 연락해 주세요.</p>
</td></tr></tbody></table>$html$,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "purpose" = 'ORDER_FORM_SUBMISSION';
