import { useEffect, useRef, useState, type FormEvent } from 'react';
import { listPlatformTenants, type PlatformTenantRow } from '../../../api/platformTenants';
import {
  closePlatformPayLink,
  createPlatformPayLink,
  fetchUsageFeeOpenPeriods,
  type UsageFeeOpenPeriod,
} from '../../../api/platformCardPayment';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { getPlatformToken } from '../../../stores/platformAuth';
import { INPUT_BASE } from '../../../utils/platformUi';
import { PlatformPayInquiryPick } from './PlatformPayInquiryPick';

type Purpose = 'INVOICE' | 'CLEANING_PROXY' | 'OTHER';

type MadeLink = {
  id: string;
  url: string;
  amountKrw: number;
  buyerName: string | null;
  tenantName: string | null;
  expiresAt: string;
  goodsName: string;
};

const BTN =
  'inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function PlatformPayLinkPanel() {
  const [purpose, setPurpose] = useState<Purpose>('CLEANING_PROXY');
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [inquiryId, setInquiryId] = useState('');
  const [periods, setPeriods] = useState<UsageFeeOpenPeriod[]>([]);
  const [periodStartYmd, setPeriodStartYmd] = useState('');
  const [goodsName, setGoodsName] = useState('입주청소 서비스');
  const [amountWon, setAmountWon] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [made, setMade] = useState<MadeLink | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLFormElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    void listPlatformTenants(token).then(setTenants).catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    if (purpose !== 'INVOICE' || !tenantId) {
      setPeriods([]);
      setPeriodStartYmd('');
      return;
    }
    void fetchUsageFeeOpenPeriods(tenantId)
      .then((res) => {
        setPeriods(res.items);
        const first = res.items[0];
        setPeriodStartYmd(first?.periodStartYmd ?? '');
        if (first) setAmountWon(String(first.chargeAmountKrw ?? first.amountKrw));
      })
      .catch(() => setPeriods([]));
  }, [purpose, tenantId]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setToast(null);
    void createPlatformPayLink({
      purpose,
      tenantId: tenantId || undefined,
      periodStartYmd: purpose === 'INVOICE' ? periodStartYmd : undefined,
      inquiryId: purpose === 'CLEANING_PROXY' ? inquiryId || undefined : undefined,
      goodsName,
      amountWon: Number(amountWon.replace(/[^\d]/g, '')),
      buyerName,
      buyerPhone,
      memo,
    })
      .then((row) => {
        setMade(row);
        setToast('결제 링크를 만들었어요');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '링크를 만들지 못했습니다.'))
      .finally(() => setBusy(false));
  }

  const amount = Number(amountWon.replace(/[^\d]/g, '')) || 0;
  const previewGoods = goodsName.trim() || '상품명';

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <form ref={scrollRef} onSubmit={onSubmit} onFocusCapture={onFieldFocus} className="modal-form-scroll-surface space-y-3 rounded-2xl border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-[#111a2b]">결제 링크 만들기</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="용도">
          {(
            [
              ['INVOICE', '이용료', '업체 이용료 청구'],
              ['CLEANING_PROXY', '청소비 대신 받기', '다른 업체 건 청소비'],
              ['OTHER', '기타', '그 밖의 결제'],
            ] as const
          ).map(([value, title, caption]) => (
            <label
              key={value}
              className={`grid cursor-pointer gap-0.5 rounded-lg border px-3 py-2 text-xs text-gray-500 ${
                purpose === value ? 'border-[#111a2b] shadow-[0_0_0_1px_#111a2b]' : 'border-gray-200'
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="pay-purpose"
                checked={purpose === value}
                onChange={() => {
                  setPurpose(value);
                  setInquiryId('');
                  if (value === 'INVOICE') setGoodsName('솔루션 이용료');
                  if (value === 'CLEANING_PROXY') setGoodsName('입주청소 서비스');
                  if (value === 'OTHER') setGoodsName('기타');
                }}
              />
              <b className="text-sm text-gray-900">{title}</b>
              {caption}
            </label>
          ))}
        </div>
        {purpose === 'CLEANING_PROXY' ? (
          <p className="rounded-lg border border-[#cdbff5] bg-[#efeafd] px-3 py-2 text-sm leading-relaxed text-[#5134a8]">
            SK클린텍이 다른 업체 건을 청소했을 때 씁니다. 고객 영수증에 SK클린텍 대신 서비스브릿지가 찍힙니다.
          </p>
        ) : null}
        {purpose !== 'OTHER' ? (
          <label className="block text-xs text-gray-600">
            {purpose === 'CLEANING_PROXY' ? '청소한 업체' : '업체'}
            <select
              className={`${INPUT_BASE} mt-1`}
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setInquiryId('');
              }}
              required
            >
              <option value="">업체를 선택하세요</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-xs text-gray-600">
            업체 (선택)
            <select className={`${INPUT_BASE} mt-1`} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">업체 없음</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {purpose === 'INVOICE' ? (
          <label className="block text-xs text-gray-600">
            결제할 달
            <select
              className={`${INPUT_BASE} mt-1`}
              value={periodStartYmd}
              required
              onChange={(e) => {
                setPeriodStartYmd(e.target.value);
                const period = periods.find((item) => item.periodStartYmd === e.target.value);
                if (period) setAmountWon(String(period.chargeAmountKrw ?? period.amountKrw));
              }}
            >
              <option value="">달을 선택하세요</option>
              {periods.map((period) => (
                <option key={period.periodStartYmd} value={period.periodStartYmd}>
                  {period.periodLabel} · {(period.chargeAmountKrw ?? period.amountKrw).toLocaleString('ko-KR')}원
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {purpose === 'CLEANING_PROXY' ? (
          <PlatformPayInquiryPick tenantId={tenantId} inquiryId={inquiryId} onChange={(id) => setInquiryId(id)} />
        ) : null}
        <label className="block text-xs text-gray-600">
          결제창에 보일 상품명
          <input className={`${INPUT_BASE} mt-1`} value={goodsName} onChange={(e) => setGoodsName(e.target.value)} required />
        </label>
        <label className="block text-xs text-gray-600">
          금액
          <input
            className={`${INPUT_BASE} mt-1`}
            inputMode="numeric"
            value={amountWon}
            readOnly={purpose === 'INVOICE'}
            onChange={(e) => setAmountWon(e.target.value.replace(/[^\d]/g, ''))}
            required
          />
        </label>
        <label className="block text-xs text-gray-600">
          고객 이름
          <input className={`${INPUT_BASE} mt-1`} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
        </label>
        <label className="block text-xs text-gray-600">
          고객 연락처 (기록용)
          <input
            className={`${INPUT_BASE} mt-1`}
            inputMode="numeric"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          />
        </label>
        <label className="block text-xs text-gray-600">
          내부 메모 (고객에게 안 보임)
          <input className={`${INPUT_BASE} mt-1`} value={memo} onChange={(e) => setMemo(e.target.value)} required={purpose === 'OTHER'} />
        </label>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <p className="text-xs text-gray-500">고객 결제창에 보이는 것</p>
          <p className="mt-1">서비스브릿지 · {previewGoods} · {won(amount)}</p>
          <p className="mt-1 text-xs text-gray-500">링크는 7일 동안 열립니다.</p>
        </div>
        <button type="submit" disabled={busy} className={`${BTN} bg-[#111a2b] text-white hover:bg-slate-800 focus-visible:ring-slate-400`}>
          {busy ? '만드는 중' : '결제 링크 만들기'}
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
      {made || toast ? (
        <section className="space-y-2">
          {toast ? <p className="w-fit rounded-lg bg-[#111a2b] px-3 py-2 text-sm text-white">{toast}</p> : null}
          {made ? <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm">{made.goodsName}</b>
            <span className="rounded-full border border-[#cdbff5] bg-[#efeafd] px-2 py-0.5 text-xs text-[#5134a8]">
              {purpose === 'INVOICE' ? '이용료' : purpose === 'OTHER' ? '기타' : '청소비 대신 받기'}
            </span>
            <span className="ml-auto rounded-full border border-[#f0d27a] bg-[#fff6dc] px-2 py-0.5 text-xs text-[#7a5300]">결제 대기</span>
          </div>
          <p className="break-all text-sm text-gray-900">{made.url}</p>
          <button
            type="button"
            className={`${BTN} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus-visible:ring-gray-400`}
            onClick={() => {
              void navigator.clipboard.writeText(made.url).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? '복사됨' : '링크 복사'}
          </button>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-gray-500">금액</dt>
            <dd className="text-right tabular-nums">{won(made.amountKrw)}</dd>
            <dt className="text-gray-500">고객</dt>
            <dd className="text-right">{made.buyerName ?? '—'}</dd>
            <dt className="text-gray-500">청소한 업체</dt>
            <dd className="text-right">{made.tenantName ?? '—'}</dd>
            <dt className="text-gray-500">열림</dt>
            <dd className="text-right">{when(made.expiresAt)}까지</dd>
          </dl>
          <button
            type="button"
            className={`${BTN} border border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-300`}
            onClick={() => {
              void closePlatformPayLink(made.id)
                .then(() => setMade(null))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : '링크를 닫지 못했습니다.'));
            }}
          >
            링크 닫기
          </button>
          </div> : null}
          <p className="text-xs leading-relaxed text-gray-500">
            결제되면 칩이 「결제 완료」로 바뀌고 승인번호·카드 끝 4자리가 붙습니다. 결제 취소는 결제 내역에서 같은 날 전액 취소만 할 수 있어요.
          </p>
        </section>
      ) : null}
    </div>
  );
}
