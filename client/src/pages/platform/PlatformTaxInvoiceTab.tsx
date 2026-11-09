import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listPlatformTaxInvoices,
  issuePlatformTaxInvoice,
  cancelPlatformTaxInvoice,
  fetchPlatformTaxInvoiceMonthStats,
  fetchPlatformTenantsForBuyer,
  downloadPlatformTaxInvoiceExcel,
  type PlatformTaxInvoiceRow,
  type PlatformReceiptMonthStats,
  type PlatformBuyerTenant,
} from '../../api/platformReceipts';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { parseListPage } from '../../utils/listPagination';
import { PlatformReceiptsFilterBar, useReceiptFilterRange } from './PlatformReceiptsFilterBar';
import { parseReceiptStatus } from './platformReceiptsFilters';

const PAGE_SIZE = 30;

function kstToday(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function statusBadge(status: PlatformTaxInvoiceRow['status']): string {
  if (status === 'ISSUED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-500';
  return 'bg-red-50 text-red-700';
}
function statusLabel(status: PlatformTaxInvoiceRow['status']): string {
  if (status === 'ISSUED') return '발행됨';
  if (status === 'CANCELLED') return '취소됨';
  return '실패';
}

export function PlatformTaxInvoiceTab({ certValid = true }: { certValid?: boolean }) {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const range = useReceiptFilterRange(params);
  const status = parseReceiptStatus(params.get('status'));
  const q = params.get('q') || '';
  const filterKey = useMemo(
    () => `${range.from}|${range.to}|${status}|${q}|${page}`,
    [range.from, range.to, status, q, page],
  );

  const [stats, setStats] = useState<PlatformReceiptMonthStats | null>(null);
  const [items, setItems] = useState<PlatformTaxInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listErr, setListErr] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<PlatformBuyerTenant[]>([]);
  const [exporting, setExporting] = useState(false);

  // Issue form state
  const [showForm, setShowForm] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [writeDate, setWriteDate] = useState(kstToday());
  const [corpNum, setCorpNum] = useState('');
  const [corpName, setCorpName] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [addr, setAddr] = useState('');
  const [bizType, setBizType] = useState('');
  const [bizClass, setBizClass] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [supplyText, setSupplyText] = useState('');
  const [vatText, setVatText] = useState('');
  const [autoVat, setAutoVat] = useState(true);
  const [itemName, setItemName] = useState('청소비서 이용료');
  const [memo, setMemo] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueErr, setIssueErr] = useState<string | null>(null);

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  const listFilter = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      status: status || undefined,
      q: q || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [range.from, range.to, status, q, page],
  );

  const loadList = useCallback(() => {
    listPlatformTaxInvoices(listFilter)
      .then((res) => { setItems(res.items); setTotal(res.total); setListErr(null); })
      .catch((e: unknown) => setListErr(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'));
  }, [listFilter]);

  useEffect(() => { loadList(); }, [loadList, filterKey]);

  useEffect(() => {
    fetchPlatformTaxInvoiceMonthStats({
      from: range.from,
      to: range.to,
      status: status || undefined,
      q: q || undefined,
    }).then(setStats).catch(() => undefined);
  }, [range.from, range.to, status, q]);

  useEffect(() => {
    fetchPlatformTenantsForBuyer().then((r) => setBuyers(r.items)).catch(() => undefined);
  }, []);

  function patchParams(patch: Record<string, string | null>, resetPage = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.set('page', '1');
    setParams(next, { replace: true });
  }

  const supplyNum = Number(supplyText.replace(/\D/g, '')) || 0;
  const vatNum = autoVat ? Math.round(supplyNum * 0.1) : (Number(vatText.replace(/\D/g, '')) || 0);
  const totalNum = supplyNum + vatNum;

  function selectTenant(id: string) {
    setSelectedTenantId(id);
    const t = buyers.find((b) => b.id === id);
    if (t) {
      setCorpNum(t.corpNum ?? '');
      setCorpName(t.corpName ?? t.name);
      setCeoName(t.ceoName ?? '');
      setAddr(t.addr ?? '');
      setBizType(t.bizType ?? '');
      setBizClass(t.bizClass ?? '');
      setBuyerEmail(t.email ?? '');
    }
  }

  async function handleIssue() {
    if (!certValid) { setIssueErr('공동인증서를 먼저 등록해 주세요.'); return; }
    if (!corpNum.trim()) { setIssueErr('사업자번호를 입력해 주세요.'); return; }
    if (!corpName.trim()) { setIssueErr('법인명을 입력해 주세요.'); return; }
    if (!supplyNum) { setIssueErr('공급가액을 입력해 주세요.'); return; }
    setIssuing(true);
    setIssueErr(null);
    try {
      await issuePlatformTaxInvoice({
        tenantId: selectedTenantId || undefined,
        writeDate,
        corpNum: corpNum.trim(),
        corpName: corpName.trim(),
        ceoName: ceoName.trim() || undefined,
        addr: addr.trim() || undefined,
        email: buyerEmail.trim() || undefined,
        bizType: bizType.trim() || undefined,
        bizClass: bizClass.trim() || undefined,
        supplyAmountKrw: supplyNum,
        vatAmountKrw: vatNum,
        itemName,
        memo: memo.trim() || undefined,
      });
      setCorpNum('');
      setCorpName('');
      setCeoName('');
      setAddr('');
      setBizType('');
      setBizClass('');
      setBuyerEmail('');
      setSupplyText('');
      setVatText('');
      setMemo('');
      setSelectedTenantId('');
      setShowForm(false);
      fetchPlatformTaxInvoiceMonthStats({
        from: range.from,
        to: range.to,
        status: status || undefined,
        q: q || undefined,
      }).then(setStats).catch(() => undefined);
      loadList();
    } catch (e) {
      setIssueErr(e instanceof Error ? e.message : '발행에 실패했습니다.');
    } finally {
      setIssuing(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadPlatformTaxInvoiceExcel({
        from: range.from,
        to: range.to,
        status: status || undefined,
        q: q || undefined,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '엑셀을 받지 못했습니다.');
    } finally {
      setExporting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm('세금계산서를 취소하시겠습니까?')) return;
    setCancellingId(id);
    setCancelErr(null);
    try {
      await cancelPlatformTaxInvoice(id);
      loadList();
    } catch (e) {
      setCancelErr(e instanceof Error ? e.message : '취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PlatformReceiptsFilterBar params={params} onChange={patchParams} onExport={() => void handleExport()} exporting={exporting} />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: `발행 건수 · ${range.label}`, value: `${stats.count.toLocaleString('ko-KR')}건` },
            { label: `바로빌 원가 · ${range.label}`, value: won(stats.costKrw ?? 0) },
            { label: `공급가 · ${range.label}`, value: won(stats.supplyAmountKrw) },
            { label: `총액 · ${range.label}`, value: won(stats.totalAmountKrw) },
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
          <h2 className="text-base font-semibold text-gray-900">세금계산서 발행</h2>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!certValid}
            title={!certValid ? '공동인증서를 먼저 등록해 주세요' : undefined}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-gray-700">
                사업자번호 <span className="text-red-500">*</span>
                <input
                  className={`${INPUT_BASE} mt-1`}
                  value={corpNum}
                  onChange={(e) => setCorpNum(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  placeholder="숫자 10자리"
                />
              </label>
              <label className="block space-y-1 text-sm text-gray-700">
                법인·상호명 <span className="text-red-500">*</span>
                <input
                  className={`${INPUT_BASE} mt-1`}
                  value={corpName}
                  onChange={(e) => setCorpName(e.target.value)}
                  placeholder="주식회사 OO"
                />
              </label>
              <label className="block space-y-1 text-sm text-gray-700">
                대표자명
                <input className={`${INPUT_BASE} mt-1`} value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="홍길동" />
              </label>
              <label className="block space-y-1 text-sm text-gray-700">
                업태
                <input className={`${INPUT_BASE} mt-1`} value={bizType} onChange={(e) => setBizType(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm text-gray-700">
                종목
                <input className={`${INPUT_BASE} mt-1`} value={bizClass} onChange={(e) => setBizClass(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm text-gray-700">
                이메일 (전자계산서 발송)
                <input type="email" className={`${INPUT_BASE} mt-1`} value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
              </label>
            </div>

            <label className="block space-y-1 text-sm text-gray-700">
              주소
              <input className={`${INPUT_BASE} mt-1`} value={addr} onChange={(e) => setAddr(e.target.value)} />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-gray-700">
                공급가액 <span className="text-red-500">*</span>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    inputMode="numeric"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    value={supplyNum > 0 ? supplyNum.toLocaleString('ko-KR') : ''}
                    onChange={(e) => setSupplyText(e.target.value.replace(/\D/g, ''))}
                  />
                  <span className="text-sm">원</span>
                </div>
              </label>
              <label className="block space-y-1 text-sm text-gray-700">
                <span className="flex items-center gap-2">
                  부가세
                  <label className="inline-flex items-center gap-1 text-xs text-gray-500 font-normal">
                    <input
                      type="checkbox"
                      checked={autoVat}
                      onChange={(e) => { setAutoVat(e.target.checked); setVatText(''); }}
                    />
                    자동(10%)
                  </label>
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    inputMode="numeric"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    value={autoVat ? (vatNum > 0 ? vatNum.toLocaleString('ko-KR') : '') : (Number(vatText.replace(/\D/g, '')) > 0 ? Number(vatText.replace(/\D/g, '')).toLocaleString('ko-KR') : '')}
                    readOnly={autoVat}
                    onChange={(e) => { if (!autoVat) setVatText(e.target.value.replace(/\D/g, '')); }}
                  />
                  <span className="text-sm">원</span>
                </div>
              </label>
            </div>

            {totalNum > 0 ? (
              <p className="text-xs text-gray-500">합계 {won(totalNum)}</p>
            ) : null}

            <label className="block space-y-1 text-sm text-gray-700">
              품목명
              <input className={`${INPUT_BASE} mt-1`} value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </label>

            <label className="block space-y-1 text-sm text-gray-700">
              작성일
              <input type="date" className={`${INPUT_BASE} mt-1`} value={writeDate} max={kstToday()} onChange={(e) => setWriteDate(e.target.value)} />
            </label>

            <label className="block space-y-1 text-sm text-gray-700">
              내부 메모 (선택)
              <textarea className={`${INPUT_BASE} mt-1 min-h-16 resize-none`} value={memo} onChange={(e) => setMemo(e.target.value)} />
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
          onPageChange={(next) => patchParams({ page: String(next) })}
          onPageSizeChange={() => undefined}
        />
        {/* 모바일 카드 */}
        <div className="space-y-2 lg:hidden">
          {items.map((row) => (
            <article key={row.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                  <p className="mt-1 truncate text-sm font-medium text-gray-900">{row.buyerCorpName}</p>
                  <p className="text-xs text-gray-500">{row.writeDate}{row.tenantName ? ` · ${row.tenantName}` : ''}</p>
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums text-gray-900">{won(row.totalAmountKrw)}</p>
              </div>
              {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
              {row.status === 'ISSUED' ? (
                <div className="mt-2 flex justify-end">
                  <button type="button" className={`${BTN_DANGER} py-1 text-xs`} disabled={cancellingId === row.id} onClick={() => void handleCancel(row.id)}>
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
                <th className="px-2 py-2 text-left">작성일</th>
                <th className="px-2 py-2 text-left">매수자</th>
                <th className="px-2 py-2 text-left">업체</th>
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
                  <td className="px-2 py-2 text-xs">{row.writeDate}</td>
                  <td className="px-2 py-2 text-xs">{row.buyerCorpName}<br /><span className="text-gray-400">{row.buyerCorpNum}</span></td>
                  <td className="px-2 py-2 text-xs text-gray-500">{row.tenantName ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{won(row.totalAmountKrw)}</td>
                  <td className="px-2 py-2 text-center">
                    {row.status === 'ISSUED' ? (
                      <button type="button" className={`${BTN_DANGER} py-1 text-xs`} disabled={cancellingId === row.id} onClick={() => void handleCancel(row.id)}>
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
          onPageChange={(next) => patchParams({ page: String(next) })}
          onPageSizeChange={() => undefined}
        />
      </section>
    </div>
  );
}
