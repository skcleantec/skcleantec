import { useCallback, useEffect, useState } from 'react';
import {
  listPlatformCashbills,
  issuePlatformCashbill,
  cancelPlatformCashbill,
  fetchPlatformCashbillMonthStats,
  fetchPlatformTenantsForBuyer,
  type PlatformCashbillRow,
  type PlatformReceiptMonthStats,
  type PlatformBuyerTenant,
} from '../../api/platformReceipts';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';

const PAGE_SIZE = 30;

function kstToday(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function statusBadge(status: PlatformCashbillRow['status']): string {
  if (status === 'ISSUED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-500';
  return 'bg-red-50 text-red-700';
}
function statusLabel(status: PlatformCashbillRow['status']): string {
  if (status === 'ISSUED') return '발행됨';
  if (status === 'CANCELLED') return '취소됨';
  return '실패';
}
function usageLabel(usage: PlatformCashbillRow['usage']): string {
  if (usage === 'phone') return '소득공제';
  if (usage === 'biz') return '지출증빙';
  return '자진발급';
}

export function PlatformCashbillTab() {
  const [stats, setStats] = useState<PlatformReceiptMonthStats | null>(null);
  const [items, setItems] = useState<PlatformCashbillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listErr, setListErr] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<PlatformBuyerTenant[]>([]);

  // Issue form state
  const [showForm, setShowForm] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [identity, setIdentity] = useState('');
  const [usage, setUsage] = useState<'phone' | 'biz' | 'voluntary'>('phone');
  const [taxKind, setTaxKind] = useState<'taxable' | 'exempt'>('taxable');
  const [amountText, setAmountText] = useState('');
  const [itemName, setItemName] = useState('청소비서 이용료');
  const [tradeDate, setTradeDate] = useState(kstToday());
  const [email, setEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueErr, setIssueErr] = useState<string | null>(null);

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  const loadList = useCallback(() => {
    listPlatformCashbills(PAGE_SIZE, (page - 1) * PAGE_SIZE)
      .then((res) => { setItems(res.items); setTotal(res.total); setListErr(null); })
      .catch((e: unknown) => setListErr(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'));
  }, [page]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    fetchPlatformCashbillMonthStats()
      .then(setStats)
      .catch(() => undefined);
    fetchPlatformTenantsForBuyer()
      .then((res) => setBuyers(res.items))
      .catch(() => undefined);
  }, []);

  function selectTenant(id: string) {
    setSelectedTenantId(id);
    const t = buyers.find((b) => b.id === id);
    if (t) {
      setBuyerName(t.corpName ?? t.name ?? '');
    }
  }

  async function handleIssue() {
    const amountKrw = Math.round(Number(amountText.replace(/\D/g, '')));
    if (!amountKrw) { setIssueErr('금액을 입력해 주세요.'); return; }
    if (usage !== 'voluntary' && !identity.trim()) { setIssueErr('번호를 입력해 주세요.'); return; }
    setIssuing(true);
    setIssueErr(null);
    try {
      await issuePlatformCashbill({
        tenantId: selectedTenantId || undefined,
        identity: usage !== 'voluntary' ? identity.trim() : undefined,
        usage,
        taxKind,
        amountKrw,
        itemName,
        tradeDate,
        email: email.trim() || undefined,
        buyerName: buyerName.trim() || undefined,
        memo: memo.trim() || undefined,
      });
      setAmountText('');
      setIdentity('');
      setEmail('');
      setMemo('');
      setBuyerName('');
      setSelectedTenantId('');
      setShowForm(false);
      fetchPlatformCashbillMonthStats().then(setStats).catch(() => undefined);
      loadList();
    } catch (e) {
      setIssueErr(e instanceof Error ? e.message : '발행에 실패했습니다.');
    } finally {
      setIssuing(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm('현금영수증을 취소하시겠습니까?')) return;
    setCancellingId(id);
    setCancelErr(null);
    try {
      await cancelPlatformCashbill(id);
      loadList();
    } catch (e) {
      setCancelErr(e instanceof Error ? e.message : '취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  const amountNum = Number(amountText.replace(/\D/g, '')) || 0;
  const supply = taxKind === 'exempt' ? amountNum : Math.round(amountNum / 1.1);
  const vat = taxKind === 'exempt' ? 0 : Math.max(0, amountNum - supply);

  return (
    <div className="space-y-4">
      {/* 이달 통계 */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '이달 발행 건수', value: `${stats.count.toLocaleString('ko-KR')}건` },
            { label: '바로빌 원가 합계', value: won(stats.costKrw ?? 0) },
            { label: '공급가액 합계', value: won(stats.supplyAmountKrw) },
            { label: '총액 합계', value: won(stats.totalAmountKrw) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* 발행 폼 */}
      <section className={CARD_SECTION}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">현금영수증 발행</h2>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '닫기' : '+ 발행하기'}
          </button>
        </div>
        {showForm ? (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {issueErr ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{issueErr}</p>
            ) : null}

            {/* 업체 선택 */}
            <label className="block space-y-1 text-sm text-gray-700">
              업체 (선택 시 자동 입력)
              <select
                value={selectedTenantId}
                onChange={(e) => selectTenant(e.target.value)}
                className={`${INPUT_BASE} mt-1`}
              >
                <option value="">업체 선택 안 함 (직접 입력)</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm text-gray-700">
              고객·법인명 (선택)
              <input
                className={`${INPUT_BASE} mt-1`}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="예: 홍길동 / 주식회사 OO"
              />
            </label>

            {/* 용도 */}
            <div className="space-y-1">
              <p className="text-sm text-gray-700">용도</p>
              <div className="flex flex-wrap gap-1">
                {([
                  ['phone', '소득공제(휴대폰)'],
                  ['biz', '지출증빙(사업자)'],
                  ['voluntary', '자진발급'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`rounded-lg border px-3 py-1.5 text-sm ${usage === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setUsage(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {usage !== 'voluntary' ? (
              <label className="block space-y-1 text-sm text-gray-700">
                {usage === 'phone' ? '휴대폰 번호' : '사업자번호'}
                <input
                  className={`${INPUT_BASE} mt-1`}
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder={usage === 'phone' ? '01012345678' : '1234567890'}
                  maxLength={usage === 'phone' ? 13 : 12}
                />
              </label>
            ) : null}

            {/* 거래유형 */}
            <div className="space-y-1">
              <p className="text-sm text-gray-700">거래유형</p>
              <div className="flex gap-1">
                {([
                  ['taxable', '과세'],
                  ['exempt', '면세'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`rounded-lg border px-3 py-1.5 text-sm ${taxKind === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setTaxKind(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 금액 */}
            <label className="block space-y-1 text-sm text-gray-700">
              금액
              <div className="flex items-center gap-2 mt-1">
                <input
                  inputMode="numeric"
                  className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  value={amountNum > 0 ? amountNum.toLocaleString('ko-KR') : ''}
                  onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ''))}
                />
                <span className="text-sm text-gray-700">원</span>
              </div>
              {amountNum > 0 ? (
                <span className="text-xs text-gray-500">공급가 {won(supply)} · 부가세 {won(vat)}</span>
              ) : null}
            </label>

            {/* 품목명 */}
            <label className="block space-y-1 text-sm text-gray-700">
              품목명
              <input
                className={`${INPUT_BASE} mt-1`}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </label>

            {/* 거래일 */}
            <label className="block space-y-1 text-sm text-gray-700">
              거래일
              <input
                type="date"
                className={`${INPUT_BASE} mt-1`}
                value={tradeDate}
                max={kstToday()}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </label>

            {/* 이메일 */}
            <label className="block space-y-1 text-sm text-gray-700">
              이메일 (선택 · 영수증 메일 발송)
              <input
                type="email"
                className={`${INPUT_BASE} mt-1`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {/* 내부 메모 */}
            <label className="block space-y-1 text-sm text-gray-700">
              내부 메모 (선택)
              <textarea
                className={`${INPUT_BASE} mt-1 min-h-16 resize-none`}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setShowForm(false)}>취소</button>
              <button type="button" className={BTN_PRIMARY} disabled={issuing} onClick={() => void handleIssue()}>
                {issuing ? '발행 중…' : '발행하기'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* 목록 */}
      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">발행 목록</h2>
        {listErr ? <p className="text-sm text-red-700">{listErr}</p> : null}
        {cancelErr ? <p className="text-sm text-red-700">{cancelErr}</p> : null}
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={() => undefined}
        />
        {/* 모바일 카드 */}
        <div className="space-y-2 lg:hidden">
          {items.map((row) => (
            <article key={row.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                  <p className="mt-1 truncate text-sm font-medium text-gray-900">{row.buyerName ?? '—'}{row.tenantName ? ` (${row.tenantName})` : ''}</p>
                  <p className="text-xs text-gray-500">{row.tradeDate} · {usageLabel(row.usage)} · {row.taxKind === 'taxable' ? '과세' : '면세'}</p>
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums text-gray-900">{won(row.amountKrw)}</p>
              </div>
              {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
              {row.status === 'ISSUED' ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    className={`${BTN_DANGER} py-1 text-xs`}
                    disabled={cancellingId === row.id}
                    onClick={() => void handleCancel(row.id)}
                  >
                    {cancellingId === row.id ? '취소 중…' : '취소'}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {items.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">발행 내역이 없습니다.</p> : null}
        </div>
        {/* PC 테이블 */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="px-2 py-2 text-center">상태</th>
                <th className="px-2 py-2 text-left">거래일</th>
                <th className="px-2 py-2 text-left">업체/고객</th>
                <th className="px-2 py-2 text-center">용도</th>
                <th className="px-2 py-2 text-right">공급가</th>
                <th className="px-2 py-2 text-right">부가세</th>
                <th className="px-2 py-2 text-right">합계</th>
                <th className="px-2 py-2 text-center">취소</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                    {row.error ? <p className="mt-0.5 text-xs text-red-500">{row.error}</p> : null}
                  </td>
                  <td className="px-2 py-2 text-xs">{row.tradeDate}</td>
                  <td className="px-2 py-2 text-xs">
                    {row.buyerName ?? '—'}
                    {row.tenantName ? <span className="text-gray-400"> / {row.tenantName}</span> : null}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">{usageLabel(row.usage)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{won(row.amountKrw)}</td>
                  <td className="px-2 py-2 text-center">
                    {row.status === 'ISSUED' ? (
                      <button
                        type="button"
                        className={`${BTN_DANGER} py-1 text-xs`}
                        disabled={cancellingId === row.id}
                        onClick={() => void handleCancel(row.id)}
                      >
                        {cancellingId === row.id ? '취소 중…' : '취소'}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-500">발행 내역이 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={() => undefined}
        />
      </section>
    </div>
  );
}
