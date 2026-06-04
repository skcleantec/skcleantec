-- 발주서 제목 컬럼 기본값을 테넌트 중립 문구로 변경.
-- (멀티테넌트: 신규 OrderFormConfig 행이 'SK클린텍 ...' 로 생기지 않도록.
--  기존 행 데이터는 변경하지 않는다 — 이미 설정된 업체별 제목/레거시 SK 제목 보존.)
ALTER TABLE "order_form_config" ALTER COLUMN "form_title" SET DEFAULT '입주청소 발주서';
