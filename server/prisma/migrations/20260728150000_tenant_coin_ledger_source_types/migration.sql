-- 발주서 발급·접수 상태 전환 코인 차감 원장 타입
ALTER TYPE "TenantCoinLedgerSourceType" ADD VALUE 'ORDER_FORM_ISSUE';
ALTER TYPE "TenantCoinLedgerSourceType" ADD VALUE 'INQUIRY_STATUS';
