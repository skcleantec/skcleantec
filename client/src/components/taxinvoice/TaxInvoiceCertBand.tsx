import { Button } from '../ui/Button';

function kstToday(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function daysLeft(expire: string): number | null {
  const end = Date.parse(`${expire.slice(0, 10)}T00:00:00+09:00`);
  const start = Date.parse(`${kstToday()}T00:00:00+09:00`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.round((end - start) / 86_400_000);
}

function monthDay(expire: string): string {
  const [, month, day] = expire.slice(0, 10).split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

export function TaxInvoiceCertBand({
  expireDate,
  onRegister,
}: {
  expireDate: string | null;
  onRegister: () => void;
}) {
  if (!expireDate) return null;
  const left = daysLeft(expireDate);
  if (left == null || left > 30) return null;
  const expired = left < 0;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${expired ? 'border-[#f3b8b1] bg-[#fdecea] text-[#b42318]' : 'border-[#f0d27a] bg-[#fff6dc] text-[#7a5300]'}`}>
      <div className="min-w-0">
        <p className="text-fluid-sm font-semibold">
          {expired
            ? '공동인증서가 만료되어 세금계산서를 발행할 수 없어요.'
            : `공동인증서가 ${monthDay(expireDate)}에 만료돼요 (${left}일 남음).`}
        </p>
        <p className="text-fluid-xs">
          {expired
            ? '새 인증서를 받은 뒤 다시 등록해 주세요.'
            : '만료되면 세금계산서를 발행할 수 없어요. 새 인증서를 받은 뒤 다시 등록해 주세요.'}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRegister}>인증서 다시 등록</Button>
    </div>
  );
}
