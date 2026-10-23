-- SK클린텍 간편견적 메일을 서비스접수와 연결
ALTER TABLE "sk_homepage_inquiry_mails" ADD COLUMN "inquiry_id" TEXT;

CREATE UNIQUE INDEX "sk_homepage_inquiry_mails_inquiry_id_key" ON "sk_homepage_inquiry_mails"("inquiry_id");

ALTER TABLE "sk_homepage_inquiry_mails" ADD CONSTRAINT "sk_homepage_inquiry_mails_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
