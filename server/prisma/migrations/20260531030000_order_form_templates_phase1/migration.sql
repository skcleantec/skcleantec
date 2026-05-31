-- 동적 발주서 템플릿 1단계: 스키마 토대 + 테넌트별 기본 템플릿 backfill (동작 변화 없음)
-- 멀티테넌트: 모든 신규 테이블 tenant_id + 테넌트별 격리. 기존 발급은 각 테넌트의 기본 템플릿으로 연결.

-- 1) Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "OrderFormFieldInputType" AS ENUM ('TEXT','TEXTAREA','NUMBER','MONEY','DATE','TIME','PHONE','ADDRESS','SELECT','MULTISELECT','CHECKBOX','PHOTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderFormFieldFillMode" AS ENUM ('CUSTOMER','ADMIN_LOCKED','ADMIN_PREFILL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderFormTemplateStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) order_form_templates
CREATE TABLE IF NOT EXISTS "order_form_templates" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "title"         VARCHAR(128) NOT NULL,
  "icon"          VARCHAR(32),
  "description"   TEXT,
  "status"        "OrderFormTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "version"       INTEGER NOT NULL DEFAULT 1,
  "is_default"    BOOLEAN NOT NULL DEFAULT false,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_form_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_form_templates_tenant_id_status_sort_order_idx"
  ON "order_form_templates"("tenant_id", "status", "sort_order");
CREATE INDEX IF NOT EXISTS "order_form_templates_tenant_id_is_default_idx"
  ON "order_form_templates"("tenant_id", "is_default");

DO $$ BEGIN
  ALTER TABLE "order_form_templates" ADD CONSTRAINT "order_form_templates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) order_form_template_fields
CREATE TABLE IF NOT EXISTS "order_form_template_fields" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "template_id"  TEXT NOT NULL,
  "field_key"    VARCHAR(64) NOT NULL,
  "label"        VARCHAR(128) NOT NULL,
  "help_text"    TEXT,
  "input_type"   "OrderFormFieldInputType" NOT NULL DEFAULT 'TEXT',
  "options"      JSONB NOT NULL DEFAULT '[]',
  "required"     BOOLEAN NOT NULL DEFAULT false,
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "system_field" VARCHAR(48),
  "fill_mode"    "OrderFormFieldFillMode" NOT NULL DEFAULT 'CUSTOMER',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_form_template_fields_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_form_template_fields_template_id_field_key_key"
  ON "order_form_template_fields"("template_id", "field_key");
CREATE INDEX IF NOT EXISTS "order_form_template_fields_tenant_id_template_id_sort_order_idx"
  ON "order_form_template_fields"("tenant_id", "template_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "order_form_template_fields" ADD CONSTRAINT "order_form_template_fields_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "order_form_template_fields" ADD CONSTRAINT "order_form_template_fields_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "order_form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) order_forms.template_id / template_version
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "template_id" TEXT;
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "template_version" INTEGER;

CREATE INDEX IF NOT EXISTS "order_forms_tenant_id_template_id_idx"
  ON "order_forms"("tenant_id", "template_id");

DO $$ BEGIN
  ALTER TABLE "order_forms" ADD CONSTRAINT "order_forms_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "order_form_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Backfill: 테넌트마다 기본 발주서 템플릿 1개 (없을 때만). 제목은 기존 발주서 설정에서.
INSERT INTO "order_form_templates"
  ("id","tenant_id","title","status","version","is_default","sort_order","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  t."id",
  COALESCE(NULLIF(c."form_title", ''), '기본 발주서'),
  'PUBLISHED',
  1,
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants" t
LEFT JOIN "order_form_config" c ON c."tenant_id" = t."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "order_form_templates" x
  WHERE x."tenant_id" = t."id" AND x."is_default" = true
);

-- 6) 기존 발급(order_forms)을 각 테넌트 기본 템플릿에 연결 (미연결만)
UPDATE "order_forms" o
SET "template_id" = dt."id",
    "template_version" = 1
FROM "order_form_templates" dt
WHERE dt."tenant_id" = o."tenant_id"
  AND dt."is_default" = true
  AND o."template_id" IS NULL;
