-- 20260425241000에서 enum 커밋 후 실행: 발주서 연결 + 미제출 건을 전용 상태로 정리
UPDATE "inquiries" AS i
SET status = 'ORDER_FORM_PENDING'
WHERE i.order_form_id IS NOT NULL
  AND i.status IN ('PENDING', 'DEPOSIT_COMPLETED')
  AND EXISTS (
    SELECT 1 FROM order_forms o
    WHERE o.id = i.order_form_id AND o.submitted_at IS NULL
  );
