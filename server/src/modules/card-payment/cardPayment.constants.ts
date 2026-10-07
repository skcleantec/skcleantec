export const CARD_PAYMENT_MODULE_ID = 'mod_card_payment' as const;

export const CARD_PAYMENT_STATUSES = [
  'DRAFT',
  'AWAITING_PG',
  'LINK_SENT',
  'APPROVED',
  'CANCELLED',
  'FAILED',
] as const;
