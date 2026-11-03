-- 바로빌 보조문구를 강조 보조와 분리하고, 대체문자 본문을 맞춘다.
-- ORDER_LINK 대체문자는 솔라피 LMS 그대로 둔다.

ALTER TABLE "alimtalk_templates"
  ADD COLUMN IF NOT EXISTS "barobill_extra" TEXT;

UPDATE "alimtalk_templates" SET "barobill_template_name" = '[고객] 발주서 작성·예약 안내' WHERE "code" = 'CBISEO_CUST_ORDER_LINK';
UPDATE "alimtalk_templates" SET "barobill_template_name" = '[고객] 예약(발주서) 접수 완료' WHERE "code" = 'CBISEO_CUST_ORDER_DONE';
UPDATE "alimtalk_templates" SET "barobill_template_name" = '[고객] 예약 일정 확인(무위약 마감일)' WHERE "code" = 'CBISEO_CUST_SCHEDULE_D2';

UPDATE "alimtalk_templates"
SET
  "barobill_sms_subject" = $done_subject$[청소비서] #{브랜드명} 예약 접수 완료$done_subject$,
  "barobill_sms_message" = $done_body$#{고객명}님, 발주서 접수가 완료되었습니다.

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
  "barobill_sms_subject" = $d2_subject$[청소비서] #{브랜드명} 청소 일정 안내$d2_subject$,
  "barobill_sms_message" = $d2_body$#{고객명}님, 예약하신 청소 일정입니다.

청소일 #{청소일} #{시간대}
주소 #{주소}
무위약 취소·변경 마감 #{무위약마감일}
이 날까지 연락 주시면 위약금 없이 취소·변경됩니다.
이후에는 위약금이 발생할 수 있습니다.

발주계약서 확인
https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}

안내사항(취소·위약금 기준)
https://www.cbiseo.com/info?tenant=#{업체코드}&brand=#{브랜드코드}

[취소·변경·문의]
업체명 #{업체명}
전화번호 #{문의전화}$d2_body$
WHERE "code" = 'CBISEO_CUST_SCHEDULE_D2';
