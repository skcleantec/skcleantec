-- SK클린텍 간편견적 메일을 문의내역과 연결
ALTER TABLE "sk_homepage_inquiry_mails" ADD COLUMN "landing_contact_id" TEXT;

CREATE UNIQUE INDEX "sk_homepage_inquiry_mails_landing_contact_id_key" ON "sk_homepage_inquiry_mails"("landing_contact_id");

ALTER TABLE "sk_homepage_inquiry_mails" ADD CONSTRAINT "sk_homepage_inquiry_mails_landing_contact_id_fkey" FOREIGN KEY ("landing_contact_id") REFERENCES "landing_contact_inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
