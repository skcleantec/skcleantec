import type { TenantPayRow } from '../../../api/platformTenantPayHistory';

export function won(value: number): string {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

export function kstStamp(iso: string | null): string {
  if (!iso) return '기록 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso)).replace(/\.\s/g, '.').replace(/\.$/, '');
}

export function installmentLabel(months: number | null): string {
  if (months == null) return '기록 없음';
  if (months === 0) return '일시불';
  return `${months}개월`;
}

export function cardLabel(row: Pick<TenantPayRow, 'cardIssuer' | 'cardLast4'>): string {
  const tail = row.cardLast4 ? `··${row.cardLast4}` : '';
  if (row.cardIssuer && tail) return `${row.cardIssuer} ${tail}`;
  if (tail) return tail;
  return '기록 없음';
}

export function methodLabel(method: TenantPayRow['method']): string {
  return method === 'CUSTOMER_LINK' ? '링크' : '수기';
}

export function statusLabel(row: Pick<TenantPayRow, 'status' | 'cancelRequested'>): { text: string; className: string } {
  if (row.cancelRequested && row.status === 'APPROVED') {
    return { text: '취소 요청', className: 'border-[#f0d59a] bg-[#fff8e8] text-[#8a5a00]' };
  }
  if (row.status === 'CANCELLED') {
    return { text: '취소', className: 'border-[#f3b8b1] bg-[#fdecea] text-[#b42318]' };
  }
  return { text: '승인', className: 'border-[#b7e4c7] bg-[#e8f8ee] text-[#157347]' };
}
