-- 알림톡 바로빌 1단계. 발송 기본값은 solapi. 기존 솔라피 문구는 바꾸지 않는다.

ALTER TABLE "alimtalk_templates"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(16) NOT NULL DEFAULT 'solapi',
  ADD COLUMN IF NOT EXISTS "barobill_template_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "barobill_content" TEXT,
  ADD COLUMN IF NOT EXISTS "barobill_title" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "barobill_subtitle" TEXT,
  ADD COLUMN IF NOT EXISTS "barobill_buttons_json" JSONB,
  ADD COLUMN IF NOT EXISTS "barobill_status" INTEGER,
  ADD COLUMN IF NOT EXISTS "barobill_synced_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "barobill_sms_subject" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "barobill_sms_message" TEXT;

ALTER TABLE "alimtalk_send_logs"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(16) NOT NULL DEFAULT 'solapi',
  ADD COLUMN IF NOT EXISTS "barobill_send_key" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "send_status" INTEGER,
  ADD COLUMN IF NOT EXISTS "result_message" TEXT,
  ADD COLUMN IF NOT EXISTS "sms_send_state" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMP(3);

UPDATE "alimtalk_templates"
SET
  "barobill_template_name" = '[고객] 발주서 작성·예약 안내',
  "barobill_sms_subject" = $link_subject$[청소비서] #{브랜드명} 예약 안내$link_subject$,
  "barobill_sms_message" = $link_body$[청소비서] #{브랜드명} 예약 안내

#{고객명}님, 입주·이사 청소 예약 안내입니다.

총 #{총금액}원 / 예약금 #{예약금}원
청소일 #{청소일} #{시간대}

발주서 작성 링크
https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}

문의 #{문의전화}

본 문자는 예약·접수 플랫폼 청소비서 안내입니다.
실제 청소 서비스는 #{업체명}(#{문의전화})에서 제공합니다.$link_body$
WHERE "code" = 'CBISEO_CUST_ORDER_LINK';

UPDATE "alimtalk_templates"
SET
  "barobill_template_name" = '[고객] 예약(발주서) 접수 완료',
  "barobill_sms_subject" = $done_subject$[청소비서] #{브랜드명} 예약 접수 완료$done_subject$,
  "barobill_sms_message" = $done_body$#{고객명}님, 안녕하세요.

접수번호 #{접수번호}
청소일 #{청소일} #{시간대}
주소 #{주소}
안내·동의사항 확인 #{동의일시} (고객 직접 동의·서명)

발주계약서 확인
https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}

[취소·변경·문의]
업체명 #{업체명}
전화번호 #{문의전화}$done_body$
WHERE "code" = 'CBISEO_CUST_ORDER_DONE';

UPDATE "alimtalk_templates"
SET
  "barobill_template_name" = '[고객] 예약 일정 확인(무위약 마감일)',
  "barobill_sms_subject" = $d2_subject$[청소비서] #{브랜드명} 청소 일정 안내$d2_subject$,
  "barobill_sms_message" = $d2_body$청소일 #{청소일} #{시간대}
주소 #{주소}

무위약 취소·변경 마감 #{무위약마감일}
#{무위약마감일}까지 연락 주시면 위약금 없이 처리해 드립니다.
이후 취소·변경 시에는 위약금이 발생할 수 있습니다.

발주계약서 확인
https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}

안내사항(취소·위약금 기준)
https://www.cbiseo.com/info?tenant=#{업체코드}&brand=#{브랜드코드}

[취소·변경·문의]
업체명 #{업체명}
전화번호 #{문의전화}$d2_body$
WHERE "code" = 'CBISEO_CUST_SCHEDULE_D2';
