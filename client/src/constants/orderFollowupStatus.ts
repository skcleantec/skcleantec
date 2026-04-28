/** 서버 `OrderFollowupStatus` 와 동일 */
export type OrderFollowupStatus =
  | 'REQUESTED'
  | 'ABSENT'
  | 'DEPOSIT_PENDING'
  | 'ON_HOLD'
  | 'RESERVED'
  | 'FULFILLED';

export const ORDER_FOLLOWUP_STATUS_LABEL: Record<OrderFollowupStatus, string> = {
  REQUESTED: '요청',
  ABSENT: '부재',
  DEPOSIT_PENDING: '예약금 대기',
  ON_HOLD: '보류·고민',
  RESERVED: '입금 완료',
  FULFILLED: '처리 완료',
};

export const ORDER_FOLLOWUP_STATUS_OPTIONS: { value: OrderFollowupStatus; label: string }[] = [
  { value: 'REQUESTED', label: ORDER_FOLLOWUP_STATUS_LABEL.REQUESTED },
  { value: 'ABSENT', label: ORDER_FOLLOWUP_STATUS_LABEL.ABSENT },
  { value: 'DEPOSIT_PENDING', label: ORDER_FOLLOWUP_STATUS_LABEL.DEPOSIT_PENDING },
  { value: 'ON_HOLD', label: ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD },
  { value: 'RESERVED', label: ORDER_FOLLOWUP_STATUS_LABEL.RESERVED },
  { value: 'FULFILLED', label: ORDER_FOLLOWUP_STATUS_LABEL.FULFILLED },
];
