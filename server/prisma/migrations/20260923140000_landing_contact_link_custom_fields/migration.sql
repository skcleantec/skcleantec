-- 짧은 문의 링크마다 추가 입력 항목을 둔다. 비어 있으면 성함·연락처·문의 내용만.
ALTER TABLE "landing_contact_source_links" ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '[]';
