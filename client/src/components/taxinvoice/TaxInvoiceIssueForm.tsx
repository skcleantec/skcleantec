import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { isValidKoreanBizNumberChecksum } from '@shared/authSignup';
import { issueTaxInvoice, searchTaxInvoiceInquiries, type TaxInvoiceBrand, type TaxInvoiceSearchHit } from '../../api/taxInvoices';
import { IssueModalFrame } from '../receipts/IssueModalFrame';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';

const INPUT =
  'mt-1 block w-full min-h-9 rounded-lg border border-gray-200 px-3 py-2 text-fluid-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Line = { name: string; total: string; supply: string; tax: string; edited: boolean };

function kstToday(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const t = new Date(`${ymd}T12:00:00+09:00`).getTime() + days * 86400000;
  return new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function writeDateOptions(): string[] {
  const today = kstToday();
  const day = Number(today.slice(8, 10));
  const monthStart = `${today.slice(0, 8)}01`;
  const min = day <= 10 ? `${addDays(monthStart, -1).slice(0, 8)}01` : monthStart;
  const out: string[] = [];
  let cur = min;
  while (cur <= today) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out.reverse();
}

function splitTotal(total: number): { supply: number; tax: number } {
  const supply = Math.round(total / 1.1);
  return { supply, tax: total - supply };
}

const emptyLine = (): Line => ({ name: '청소 서비스', total: '', supply: '', tax: '', edited: false });

export function TaxInvoiceIssueForm({ brands, onClose, onDone }: { brands: TaxInvoiceBrand[]; onClose: () => void; onDone: (issueId: string) => void }) {
  const { summary, openCharge, reload } = useReceiptWallet();
  const linkedBrands = brands.filter((brand) => brand.linked);
  const dates = useMemo(() => writeDateOptions(), []);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TaxInvoiceSearchHit[]>([]);
  const [picked, setPicked] = useState<TaxInvoiceSearchHit | null>(null);
  const [unmatched, setUnmatched] = useState(false);
  const [brandId, setBrandId] = useState(linkedBrands[0]?.id ?? '');
  const [purpose, setPurpose] = useState<1 | 2>(1);
  const [writeDate, setWriteDate] = useState(dates[0] ?? kstToday());
  const [corpNum, setCorpNum] = useState('');
  const [corpName, setCorpName] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [addr, setAddr] = useState('');
  const [email, setEmail] = useState('');
  const [bizType, setBizType] = useState('');
  const [bizClass, setBizClass] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [memo, setMemo] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = (picked && !unmatched ? brands.find((item) => item.id === picked.brandId) : brands.find((item) => item.id === brandId)) ?? null;
  const blocked = brand?.simplified
    ? '간이과세자는 세금계산서를 발행할 수 없습니다'
    : brand && !brand.certValid
      ? '공동인증서가 없거나 만료되었습니다. 계산서 연결에서 공동인증서 등록을 해 주세요.'
      : null;

  async function search() {
    setError(null);
    try {
      setHits(await searchTaxInvoiceInquiries(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : '접수를 찾지 못했습니다.');
    }
  }

  function applyHit(hit: TaxInvoiceSearchHit) {
    setPicked(hit);
    setUnmatched(false);
    setBrandId(hit.brandId);
    if (hit.buyer) {
      setCorpName(hit.buyer.corpName);
      setEmail(hit.buyer.email);
      setAddr(hit.buyer.addr);
    }
  }

  function patchLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, ...patch };
      if (patch.total != null && !patch.edited && !line.edited) {
        const total = Math.round(Number(patch.total.replace(/,/g, '')));
        if (Number.isFinite(total) && total > 0) {
          const split = splitTotal(total);
          next.supply = String(split.supply);
          next.tax = String(split.tax);
        }
      }
      if (patch.supply != null || patch.tax != null) next.edited = true;
      return next;
    }));
  }

  async function submit() {
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!isValidKoreanBizNumberChecksum(corpNum)) {
      setError('공급받는자 사업자등록번호가 올바르지 않습니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const issued = await issueTaxInvoice({
        inquiryId: unmatched ? null : picked?.id ?? null,
        operatingCompanyId: unmatched || !picked ? brandId : picked.brandId,
        requestId: crypto.randomUUID(),
        purposeType: purpose,
        writeDate,
        buyer: { corpNum, corpName, ceoName, addr, email, bizType, bizClass },
        lines: lines.map((line) => ({
          name: line.name,
          total: Math.round(Number(line.total.replace(/,/g, ''))),
          supply: Math.round(Number(line.supply.replace(/,/g, ''))),
          tax: Math.round(Number(line.tax.replace(/,/g, ''))),
        })),
        internalMemo: memo,
      });
      await reload();
      onDone(issued.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '세금계산서 발행에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <IssueModalFrame
      title="세금계산서 발행"
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-fluid-xs ${summary != null && summary.balanceKrw < TAXINVOICE_UNIT_PRICE_KRW ? 'text-red-700' : 'text-slate-600'}`}>
            {summary != null && summary.balanceKrw < TAXINVOICE_UNIT_PRICE_KRW
              ? '잔액이 부족합니다'
              : `발행 비용 ${TAXINVOICE_UNIT_PRICE_KRW.toLocaleString('ko-KR')}원 · 지갑 ${summary ? summary.balanceKrw.toLocaleString('ko-KR') : '…'}원 → ${summary ? (summary.balanceKrw - TAXINVOICE_UNIT_PRICE_KRW).toLocaleString('ko-KR') : '…'}원`}
          </p>
          <div className="flex gap-2">
            <button type="button" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={onClose}>취소</button>
            {summary != null && summary.balanceKrw < TAXINVOICE_UNIT_PRICE_KRW ? (
              <button type="button" className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={openCharge}>충전하기</button>
            ) : (
              <button type="button" className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none" disabled={saving || Boolean(blocked)} onClick={() => void submit()}>
                {saving ? '발행 중…' : '발행하기'}
              </button>
            )}
          </div>
        </div>
      )}
    >
      <div className="flex flex-wrap gap-2">
        <input className={INPUT} value={query} placeholder="고객명·전화번호" aria-label="고객 검색" onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="min-h-9 rounded-lg border border-slate-300 px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => void search()}>검색</button>
        <button type="button" className="min-h-9 rounded-lg border border-slate-300 px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => { setUnmatched(true); setPicked(null); }}>매칭 없이 발행</button>
      </div>
      {hits.length > 0 ? (
        <ul className="space-y-1">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="w-full rounded-lg px-2 py-1 text-left text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => applyHit(hit)}>
                {hit.customerName} · {hit.inquiryNumber} · {hit.brandName}{hit.buyer ? ' · 견적서 있음' : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-fluid-2xs text-slate-600">{unmatched ? '매칭 없이 발행합니다.' : picked ? `${picked.customerName} · ${picked.inquiryNumber}` : '접수를 고르거나 매칭 없이 발행하세요.'}</p>
      {unmatched || !picked ? (
        <label className="block text-fluid-2xs text-slate-600">
          브랜드
          <select className={INPUT} value={brandId} aria-label="브랜드" onChange={(e) => setBrandId(e.target.value)}>
            {linkedBrands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
      {blocked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs text-amber-950">
          {blocked}{' '}
          {!brand?.simplified ? <Link className="underline" to="/admin/team-leaders/cashbill">공동인증서 등록</Link> : null}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-fluid-2xs text-slate-600">사업자등록번호<input className={INPUT} inputMode="numeric" value={corpNum} onChange={(e) => setCorpNum(e.target.value)} /></label>
        <label className="text-fluid-2xs text-slate-600">상호<input className={INPUT} value={corpName} onChange={(e) => setCorpName(e.target.value)} /></label>
        <label className="text-fluid-2xs text-slate-600">대표자<input className={INPUT} value={ceoName} onChange={(e) => setCeoName(e.target.value)} /></label>
        <label className="text-fluid-2xs text-slate-600">
          이메일
          <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="mt-1 block text-fluid-2xs text-slate-500">입력하면 바로빌이 공식 영수증 안내 메일을 자동 발송합니다</span>
        </label>
        <label className="text-fluid-2xs text-slate-600 sm:col-span-2">주소<input className={INPUT} value={addr} onChange={(e) => setAddr(e.target.value)} /></label>
        <label className="text-fluid-2xs text-slate-600">업태<input className={INPUT} value={bizType} onChange={(e) => setBizType(e.target.value)} /></label>
        <label className="text-fluid-2xs text-slate-600">종목<input className={INPUT} value={bizClass} onChange={(e) => setBizClass(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-fluid-xs">
        <span className="text-slate-700">④ 영수·청구</span>
        {([1, 2] as const).map((id) => (
          <button key={id} type="button" className={`min-h-9 rounded-lg border px-2 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${purpose === id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`} onClick={() => setPurpose(id)}>
            {id === 1 ? '영수' : '청구'}
          </button>
        ))}
        <label className="inline-flex items-center gap-1">작성일자
          <select className="min-h-9 rounded-lg border border-gray-200 px-2" value={writeDate} onChange={(e) => setWriteDate(e.target.value)}>
            {dates.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-4">
          <label className="text-fluid-2xs text-slate-600">품목명<input className={INPUT} value={line.name} onChange={(e) => patchLine(index, { name: e.target.value })} /></label>
          <label className="text-fluid-2xs text-slate-600">합계<input className={INPUT} inputMode="numeric" value={line.total} onChange={(e) => patchLine(index, { total: e.target.value })} /></label>
          <label className="text-fluid-2xs text-slate-600">공급가액<input className={INPUT} inputMode="numeric" value={line.supply} onChange={(e) => patchLine(index, { supply: e.target.value })} /></label>
          <label className="text-fluid-2xs text-slate-600">세액<input className={INPUT} inputMode="numeric" value={line.tax} onChange={(e) => patchLine(index, { tax: e.target.value })} /></label>
        </div>
      ))}
      <button type="button" className="min-h-9 rounded-lg border border-slate-300 px-3 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => setLines((prev) => [...prev, emptyLine()])}>품목 추가</button>
      <button type="button" className="text-fluid-xs text-slate-600 underline hover:text-slate-900" onClick={() => setMemoOpen((open) => !open)}>+ 내부 메모 추가 (고객에게 안 보임)</button>
      {memoOpen ? <label className="block text-fluid-2xs text-slate-600">내부 메모<textarea className={INPUT} value={memo} onChange={(e) => setMemo(e.target.value)} /></label> : null}
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
    </IssueModalFrame>
  );
}
