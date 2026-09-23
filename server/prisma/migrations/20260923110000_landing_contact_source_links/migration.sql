-- 문의 짧은 링크 · 유료 자리 신청 · 문의 유입명 스냅샷
CREATE TYPE "LandingContactLinkSlotKind" AS ENUM ('FREE', 'PAID');
CREATE TYPE "LandingContactLinkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "landing_contact_source_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "code" VARCHAR(32) NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "slot_kind" "LandingContactLinkSlotKind" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_contact_source_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_contact_source_links_code_key" ON "landing_contact_source_links"("code");
CREATE INDEX "landing_contact_source_links_tenant_id_is_active_idx" ON "landing_contact_source_links"("tenant_id", "is_active");

ALTER TABLE "landing_contact_source_links"
  ADD CONSTRAINT "landing_contact_source_links_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_contact_source_links"
  ADD CONSTRAINT "landing_contact_source_links_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "landing_contact_link_slot_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requested_count" INTEGER NOT NULL,
    "status" "LandingContactLinkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(500),
    "admin_note" VARCHAR(500),
    "requester_user_id" TEXT,
    "reviewed_by_platform_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_contact_link_slot_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "landing_contact_link_slot_requests_tenant_id_status_idx" ON "landing_contact_link_slot_requests"("tenant_id", "status");
CREATE INDEX "landing_contact_link_slot_requests_status_created_at_idx" ON "landing_contact_link_slot_requests"("status", "created_at");

ALTER TABLE "landing_contact_link_slot_requests"
  ADD CONSTRAINT "landing_contact_link_slot_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "landing_contact_inquiries" ADD COLUMN "source_link_id" TEXT;
ALTER TABLE "landing_contact_inquiries" ADD COLUMN "source_label" VARCHAR(40);

CREATE INDEX "landing_contact_inquiries_tenant_id_source_link_id_idx" ON "landing_contact_inquiries"("tenant_id", "source_link_id");

ALTER TABLE "landing_contact_inquiries"
  ADD CONSTRAINT "landing_contact_inquiries_source_link_id_fkey"
  FOREIGN KEY ("source_link_id") REFERENCES "landing_contact_source_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
