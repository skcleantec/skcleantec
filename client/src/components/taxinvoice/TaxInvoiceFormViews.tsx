import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { docTitle, formatBizInput, formatMoneyInput, lineSupply, lineTax, won, type TaxFormLine, type TaxKind, type TaxParty } from './taxInvoiceFormModel';
import './taxinvoice-issue.css';

const RED = 'var(--red-line)';
const BLUE = 'var(--blue-line)';

export type TaxFormProps = {
  readOnly: boolean;
  supplier: TaxParty;
  buyer: TaxParty;
  onBuyer: (patch: Partial<TaxParty>) => void;
  corpState: 'ok' | 'bad' | 'empty';
  writeDate: string;
  dateMin: string;
  dateMax: string;
  onWriteDate: (value: string) => void;
  purpose: 1 | 2;
  onPurpose: (value: 1 | 2) => void;
  remark: string;
  onRemark: (value: string) => void;
  lines: TaxFormLine[];
  onLine: (index: number, patch: Partial<TaxFormLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  cash: string;
  chkBill: string;
  note: string;
  credit: string;
  onMoney: (key: 'cash' | 'chkBill' | 'note' | 'credit', value: string) => void;
  supplySum: number;
  taxSum: number;
  totalSum: number;
  taxKind: TaxKind;
};

function dash(value: string): string {
  const text = value.trim();
  return text || '—';
}

function purposeClass(on: boolean, side: 'l' | 'r'): string {
  const radius = side === 'l' ? 'rounded-l-md' : 'rounded-r-md';
  return `pt ${radius} px-3 py-1.5 text-sm font-semibold ${on ? 'bg-gray-900 text-white' : 'text-gray-600'}`;
}

export function TaxInvoicePaper({ idPrefix = 'pc', ...props }: TaxFormProps & { idPrefix?: string }) {
  const { readOnly, supplier, buyer, lines, taxKind } = props;
  const exempt = taxKind === 'exempt';
  const lineCols = exempt
    ? '44px 44px 1fr 90px 70px 120px 150px 1fr 32px'
    : '44px 44px 1fr 90px 70px 120px 130px 110px 1fr 32px';
  const dateCols = exempt ? '150px 1fr 2fr' : '150px 1fr 1fr 2fr';
  const bizMark = props.corpState === 'ok' ? '✓' : props.corpState === 'bad' ? '확인 필요' : '';
  return (
    <div className="overflow-x-auto">
      <article className="mx-auto min-w-[1000px] max-w-[1080px] rounded-sm bg-white px-10 py-8 shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_rgba(17,24,39,.08)]">
        <header className="mb-5 flex items-end justify-between">
          <div className="w-48 text-xs text-gray-500">공급자 보관용</div>
          <h2 id="doc-title" className="text-center text-[28px] font-black tracking-[.55em] text-gray-900">{docTitle(taxKind)}</h2>
          <div className="w-48 text-right text-xs text-gray-500">승인번호 <span className="num ml-1 text-gray-400">발행 후 표시</span></div>
        </header>

        <div className="grid grid-cols-2 border-2 border-gray-800">
          <div className="side-red flex border-r-2" style={{ borderRightColor: '#1f2937' }}>
            <div className="vtitle flex w-9 items-center justify-center border-r text-[13px]" style={{ color: 'var(--red)', background: 'var(--red-bg)', borderColor: 'var(--red-line)' }}>공급자</div>
            <div className="flex-1 text-[13px]">
              <div className="grid grid-cols-[84px_1fr_64px_88px]" style={{ borderColor: RED }}>
                <div className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: RED }}>등록번호</div>
                <div className="num border-b border-r px-2.5 py-2 text-[15px] font-semibold" style={{ borderColor: RED }}>{dash(formatBizInput(supplier.corpNum))}</div>
                <div className="lbl border-b border-r px-2 py-2" style={{ borderColor: RED }}>종사업장</div>
                <div className={`border-b px-2 py-2 ${supplier.taxRegId.trim() ? '' : 'text-gray-300'}`} style={{ borderColor: RED }}>{dash(supplier.taxRegId)}</div>

                <div className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: RED }}>상호</div>
                <div className="border-b border-r px-2.5 py-2 font-medium" style={{ borderColor: RED }}>{dash(supplier.corpName)}</div>
                <div className="lbl border-b border-r px-2 py-2" style={{ borderColor: RED }}>성명</div>
                <div className="border-b px-2 py-2 font-medium" style={{ borderColor: RED }}>{dash(supplier.ceoName)}</div>

                <div className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: RED }}>사업장 주소</div>
                <div className="col-span-3 border-b px-2.5 py-2" style={{ borderColor: RED }}>{dash(supplier.addr)}</div>

                <div className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: RED }}>업태</div>
                <div className="border-b border-r px-2.5 py-2" style={{ borderColor: RED }}>{dash(supplier.bizType)}</div>
                <div className="lbl border-b border-r px-2 py-2" style={{ borderColor: RED }}>종목</div>
                <div className="border-b px-2 py-2 text-[12px] leading-snug" style={{ borderColor: RED }}>{dash(supplier.bizClass)}</div>

                <div className="lbl border-r px-2.5 py-2" style={{ borderColor: RED }}>이메일</div>
                <div className="col-span-3 flex items-center justify-between px-2.5 py-2">
                  <span className="min-w-0 break-all">{dash(supplier.email)}</span>
                  {readOnly ? null : (
                    <Link to="/admin/team-leaders/cashbill" className="shrink-0 text-[11px] text-gray-400 underline-offset-2 hover:underline">계산서 연결에서 수정</Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="side-blue flex">
            <div className="vtitle flex w-9 items-center justify-center border-r text-[13px]" style={{ color: 'var(--blue)', background: 'var(--blue-bg)', borderColor: 'var(--blue-line)' }}>공급받는자</div>
            <div className="flex-1 text-[13px]">
              <div className="grid grid-cols-[84px_1fr_64px_88px]">
                <label htmlFor={`${idPrefix}-r-biz`} className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: BLUE }}>등록번호 <span style={{ color: 'var(--red)' }}>*</span></label>
                <div className="cell num flex items-center gap-1 border-b border-r px-2.5 py-1.5 text-[15px] font-semibold" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-biz`} value={formatBizInput(buyer.corpNum)} inputMode="numeric" readOnly={readOnly} onChange={(event) => props.onBuyer({ corpNum: event.target.value })} />
                  {bizMark ? <span className={`text-xs font-medium ${props.corpState === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{bizMark}</span> : null}
                </div>
                <label htmlFor={`${idPrefix}-r-sub`} className="lbl border-b border-r px-2 py-2" style={{ borderColor: BLUE }}>종사업장</label>
                <div className="cell border-b px-2 py-1.5" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-sub`} placeholder="없음" value={buyer.taxRegId} readOnly={readOnly} onChange={(event) => props.onBuyer({ taxRegId: event.target.value.replace(/\D/g, '').slice(0, 10) })} />
                </div>

                <label htmlFor={`${idPrefix}-r-name`} className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: BLUE }}>상호 <span style={{ color: 'var(--red)' }}>*</span></label>
                <div className="cell border-b border-r px-2.5 py-1.5 font-medium" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-name`} value={buyer.corpName} readOnly={readOnly} onChange={(event) => props.onBuyer({ corpName: event.target.value })} />
                </div>
                <label htmlFor={`${idPrefix}-r-ceo`} className="lbl border-b border-r px-2 py-2" style={{ borderColor: BLUE }}>성명 <span style={{ color: 'var(--red)' }}>*</span></label>
                <div className="cell border-b px-2 py-1.5 font-medium" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-ceo`} value={buyer.ceoName} readOnly={readOnly} onChange={(event) => props.onBuyer({ ceoName: event.target.value })} />
                </div>

                <label htmlFor={`${idPrefix}-r-addr`} className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: BLUE }}>사업장 주소</label>
                <div className="cell col-span-3 border-b px-2.5 py-1.5" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-addr`} value={buyer.addr} readOnly={readOnly} onChange={(event) => props.onBuyer({ addr: event.target.value })} />
                </div>

                <label htmlFor={`${idPrefix}-r-type`} className="lbl border-b border-r px-2.5 py-2" style={{ borderColor: BLUE }}>업태</label>
                <div className="cell border-b border-r px-2.5 py-1.5" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-type`} value={buyer.bizType} readOnly={readOnly} onChange={(event) => props.onBuyer({ bizType: event.target.value })} />
                </div>
                <label htmlFor={`${idPrefix}-r-item`} className="lbl border-b border-r px-2 py-2" style={{ borderColor: BLUE }}>종목</label>
                <div className="cell border-b px-2 py-1.5" style={{ borderColor: BLUE }}>
                  <input id={`${idPrefix}-r-item`} value={buyer.bizClass} readOnly={readOnly} onChange={(event) => props.onBuyer({ bizClass: event.target.value })} />
                </div>

                <label htmlFor={`${idPrefix}-r-mail`} className="lbl border-r px-2.5 py-2" style={{ borderColor: BLUE }}>이메일 <span style={{ color: 'var(--red)' }}>*</span></label>
                <div className="cell col-span-3 px-2.5 py-1.5">
                  <input id={`${idPrefix}-r-mail`} value={buyer.email} inputMode="email" readOnly={readOnly} onChange={(event) => props.onBuyer({ email: event.target.value })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid border-x-2 border-b-2 border-gray-800 text-[13px]" style={{ gridTemplateColumns: dateCols }}>
          <div className="border-r border-gray-300 bg-gray-50 px-3 py-1.5 text-center text-xs text-gray-600">작성일자</div>
          <div className="border-r border-gray-300 bg-gray-50 px-3 py-1.5 text-center text-xs text-gray-600">공급가액</div>
          {exempt ? null : <div className="taxcol border-r border-gray-300 bg-gray-50 px-3 py-1.5 text-center text-xs text-gray-600">세액</div>}
          <div className="bg-gray-50 px-3 py-1.5 text-center text-xs text-gray-600">비고</div>
          <div className="cell num border-r border-t border-gray-300 px-3 py-2 text-center">
            <input id={`${idPrefix}-w-date`} type="date" value={props.writeDate} min={props.dateMin} max={props.dateMax} className="text-center" readOnly={readOnly} onChange={(event) => props.onWriteDate(event.target.value)} />
          </div>
          <div className="num border-r border-t border-gray-300 px-3 py-2 text-right text-[15px] font-semibold">{won(props.supplySum)}</div>
          {exempt ? null : <div className="taxcol num border-r border-t border-gray-300 px-3 py-2 text-right text-[15px] font-semibold">{won(props.taxSum)}</div>}
          <div className="cell border-t border-gray-300 px-3 py-2">
            <input id={`${idPrefix}-w-note`} placeholder="예: 10월 정기 청소" value={props.remark} readOnly={readOnly} onChange={(event) => props.onRemark(event.target.value)} />
          </div>
        </div>

        <div className="border-x-2 border-b-2 border-gray-800 text-[13px]">
          <div className="grid bg-gray-50 text-center text-xs text-gray-600" style={{ gridTemplateColumns: lineCols }}>
            <div className="border-r border-gray-300 py-1.5">월</div>
            <div className="border-r border-gray-300 py-1.5">일</div>
            <div className="border-r border-gray-300 py-1.5">품목</div>
            <div className="border-r border-gray-300 py-1.5">규격</div>
            <div className="border-r border-gray-300 py-1.5">수량</div>
            <div className="border-r border-gray-300 py-1.5">단가</div>
            <div className="border-r border-gray-300 py-1.5">공급가액</div>
            {exempt ? null : <div className="taxcol border-r border-gray-300 py-1.5">세액</div>}
            <div className="border-r border-gray-300 py-1.5">비고</div>
            <div className="py-1.5" />
          </div>
          {lines.map((line, index) => {
            const supply = line.supplyEdited ? line.supply : won(lineSupply(line));
            const tax = taxKind === 'taxable' && line.taxEdited ? line.tax : won(lineTax(line, taxKind));
            return (
              <div key={index} className="grid border-t border-gray-300 text-[13px]" style={{ gridTemplateColumns: lineCols }}>
                <div className="cell num border-r border-gray-300 px-1 py-1.5"><input className="text-center" value={line.month} inputMode="numeric" aria-label="월" readOnly={readOnly} onChange={(event) => props.onLine(index, { month: event.target.value.replace(/\D/g, '').slice(0, 2) })} /></div>
                <div className="cell num border-r border-gray-300 px-1 py-1.5"><input className="text-center" value={line.day} inputMode="numeric" aria-label="일" readOnly={readOnly} onChange={(event) => props.onLine(index, { day: event.target.value.replace(/\D/g, '').slice(0, 2) })} /></div>
                <div className="cell border-r border-gray-300 px-2.5 py-1.5"><input value={line.name} placeholder="품목명" aria-label="품목" readOnly={readOnly} onChange={(event) => props.onLine(index, { name: event.target.value })} /></div>
                <div className="cell border-r border-gray-300 px-2 py-1.5"><input value={line.spec} aria-label="규격" readOnly={readOnly} onChange={(event) => props.onLine(index, { spec: event.target.value })} /></div>
                <div className="cell num border-r border-gray-300 px-2 py-1.5"><input className="text-right" value={line.qty} inputMode="numeric" aria-label="수량" readOnly={readOnly} onChange={(event) => props.onLine(index, { qty: event.target.value.replace(/\D/g, '') })} /></div>
                <div className="cell num border-r border-gray-300 px-2 py-1.5"><input className="text-right" value={line.unitPrice} inputMode="numeric" aria-label="단가" readOnly={readOnly} onChange={(event) => props.onLine(index, { unitPrice: formatMoneyInput(event.target.value) })} /></div>
                <div className="cell num border-r border-gray-300 bg-gray-50/60 px-2 py-1.5 font-medium"><input className="text-right" value={supply} inputMode="numeric" aria-label="공급가액" readOnly={readOnly} onChange={(event) => props.onLine(index, { supply: formatMoneyInput(event.target.value) })} /></div>
                {exempt ? null : (
                  <div className="taxcol cell num border-r border-gray-300 bg-gray-50/60 px-2 py-1.5"><input className="text-right" value={tax} inputMode="numeric" aria-label="세액" readOnly={readOnly} disabled={taxKind !== 'taxable'} onChange={(event) => props.onLine(index, { tax: formatMoneyInput(event.target.value) })} /></div>
                )}
                <div className="cell border-r border-gray-300 px-2 py-1.5"><input value={line.remark} aria-label="품목 비고" readOnly={readOnly} onChange={(event) => props.onLine(index, { remark: event.target.value })} /></div>
                <button type="button" className="text-gray-300 hover:text-red-600" aria-label="품목 삭제" disabled={readOnly || lines.length === 1} onClick={() => props.onRemoveLine(index)}>✕</button>
              </div>
            );
          })}
          {readOnly ? null : (
            <button type="button" className="flex w-full items-center gap-1.5 border-t border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900" disabled={lines.length >= 16} onClick={props.onAddLine}>＋ 품목 추가 <span className="text-gray-400">(최대 16줄)</span></button>
          )}
        </div>

        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1.6fr] border-x-2 border-b-2 border-gray-800 text-[13px]">
          <div className="border-r border-gray-300 bg-gray-50 py-1.5 text-center text-xs text-gray-600">합계금액</div>
          <div className="border-r border-gray-300 bg-gray-50 py-1.5 text-center text-xs text-gray-600">현금</div>
          <div className="border-r border-gray-300 bg-gray-50 py-1.5 text-center text-xs text-gray-600">수표</div>
          <div className="border-r border-gray-300 bg-gray-50 py-1.5 text-center text-xs text-gray-600">어음</div>
          <div className="border-r border-gray-300 bg-gray-50 py-1.5 text-center text-xs text-gray-600">외상미수금</div>
          <div className="row-span-2 flex items-center justify-center gap-3 px-3">
            <span className="text-[13px]">이 금액을</span>
            <div role="radiogroup" className="inline-flex rounded-md ring-1 ring-gray-300">
              <button type="button" role="radio" aria-checked={props.purpose === 1} className={purposeClass(props.purpose === 1, 'l')} disabled={readOnly} onClick={() => props.onPurpose(1)}>영수</button>
              <button type="button" role="radio" aria-checked={props.purpose === 2} className={purposeClass(props.purpose === 2, 'r')} disabled={readOnly} onClick={() => props.onPurpose(2)}>청구</button>
            </div>
            <span className="text-[13px]">함</span>
          </div>
          <div className="num border-r border-t border-gray-300 px-3 py-2.5 text-right text-xl font-bold">{won(props.totalSum)}</div>
          <div className="cell num border-r border-t border-gray-300 px-3 py-2.5 text-right"><input className="text-right" inputMode="numeric" placeholder="0" aria-label="현금" value={props.cash} readOnly={readOnly} onChange={(event) => props.onMoney('cash', formatMoneyInput(event.target.value))} /></div>
          <div className="cell num border-r border-t border-gray-300 px-3 py-2.5 text-right"><input className="text-right" inputMode="numeric" placeholder="0" aria-label="수표" value={props.chkBill} readOnly={readOnly} onChange={(event) => props.onMoney('chkBill', formatMoneyInput(event.target.value))} /></div>
          <div className="cell num border-r border-t border-gray-300 px-3 py-2.5 text-right"><input className="text-right" inputMode="numeric" placeholder="0" aria-label="어음" value={props.note} readOnly={readOnly} onChange={(event) => props.onMoney('note', formatMoneyInput(event.target.value))} /></div>
          <div className="cell num border-r border-t border-gray-300 px-3 py-2.5 text-right"><input className="text-right" inputMode="numeric" placeholder="0" aria-label="외상미수금" value={props.credit} readOnly={readOnly} onChange={(event) => props.onMoney('credit', formatMoneyInput(event.target.value))} /></div>
        </div>

        <p className="mt-3 text-[11px] text-gray-400">작성일자 기준 다음 달 10일까지 발행할 수 있습니다 · 발행 후 다음 영업일 14시에 국세청으로 전송되며, 그 전까지 취소할 수 있습니다.</p>
      </article>
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function TaxInvoiceMobileCards(props: TaxFormProps) {
  const { supplier, buyer, lines, readOnly, taxKind } = props;
  const exempt = taxKind === 'exempt';
  const [extra, setExtra] = useState(false);
  const bizMark = props.corpState === 'ok' ? '✓' : props.corpState === 'bad' ? '확인 필요' : '';
  return (
    <div className="space-y-3 text-[14px]">
      <details className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
        <summary className="flex cursor-pointer list-none items-center gap-2 border-l-4 px-3 py-3" style={{ borderColor: 'var(--red)' }}>
          <span className="text-xs font-bold" style={{ color: 'var(--red)' }}>공급자</span>
          <span className="min-w-0 flex-1 truncate">{dash(supplier.corpName)}</span>
          <span className="num text-xs text-gray-500">{dash(formatBizInput(supplier.corpNum))}</span>
        </summary>
        <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 border-t border-gray-100 px-3 py-3 text-[13px]">
          <dt className="text-gray-500">성명</dt><dd>{dash(supplier.ceoName)}</dd>
          <dt className="text-gray-500">주소</dt><dd>{dash(supplier.addr)}</dd>
          <dt className="text-gray-500">업태·종목</dt><dd>{dash(supplier.bizType)} · {dash(supplier.bizClass)}</dd>
          <dt className="text-gray-500">이메일</dt><dd className="break-all">{dash(supplier.email)}</dd>
        </dl>
      </details>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
        <div className="border-l-4 px-3 py-2.5 text-xs font-bold" style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}>공급받는자</div>
        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
          <MobileField label="등록번호 *">
            <div className="mt-1 flex items-center gap-2 rounded-lg px-3 ring-1 ring-gray-300">
              <input className="num h-11 flex-1 bg-transparent text-[15px] font-semibold outline-none" inputMode="numeric" aria-label="등록번호" value={formatBizInput(buyer.corpNum)} readOnly={readOnly} onChange={(event) => props.onBuyer({ corpNum: event.target.value })} />
              {bizMark ? <span className={props.corpState === 'ok' ? 'text-emerald-600' : 'text-red-600'}>{bizMark}</span> : null}
            </div>
          </MobileField>
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <MobileField label="상호 *"><input className="mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" aria-label="상호" value={buyer.corpName} readOnly={readOnly} onChange={(event) => props.onBuyer({ corpName: event.target.value })} /></MobileField>
            <MobileField label="성명 *"><input className="mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" aria-label="성명" value={buyer.ceoName} readOnly={readOnly} onChange={(event) => props.onBuyer({ ceoName: event.target.value })} /></MobileField>
          </div>
          <MobileField label="이메일 *"><input className="mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" inputMode="email" aria-label="이메일" value={buyer.email} readOnly={readOnly} onChange={(event) => props.onBuyer({ email: event.target.value })} /></MobileField>
          <button type="button" className="text-xs text-gray-400" onClick={() => setExtra((open) => !open)}>주소 · 업태 · 종목 · 종사업장 ›</button>
          {extra ? (
            <div className="space-y-3">
              <MobileField label="주소"><input className="mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" aria-label="주소" value={buyer.addr} readOnly={readOnly} onChange={(event) => props.onBuyer({ addr: event.target.value })} /></MobileField>
              <MobileField label="업태"><input className="mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" aria-label="업태" value={buyer.bizType} readOnly={readOnly} onChange={(event) => props.onBuyer({ bizType: event.target.value })} /></MobileField>
              <MobileField label="종목"><input className="mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" aria-label="종목" value={buyer.bizClass} readOnly={readOnly} onChange={(event) => props.onBuyer({ bizClass: event.target.value })} /></MobileField>
              <MobileField label="종사업장"><input className="num mt-1 h-11 w-full rounded-lg px-3 ring-1 ring-gray-300" inputMode="numeric" aria-label="종사업장" value={buyer.taxRegId} readOnly={readOnly} onChange={(event) => props.onBuyer({ taxRegId: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></MobileField>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-200">
        <span className="text-xs text-gray-500">작성일자</span>
        <input type="date" className="num bg-transparent font-medium outline-none" aria-label="작성일자" value={props.writeDate} min={props.dateMin} max={props.dateMax} readOnly={readOnly} onChange={(event) => props.onWriteDate(event.target.value)} />
        <div className="ml-auto inline-flex rounded-md text-[13px] ring-1 ring-gray-300">
          <button type="button" className={`rounded-l-md px-3 py-1.5 font-semibold ${props.purpose === 1 ? 'bg-gray-900 text-white' : 'text-gray-600'}`} disabled={readOnly} onClick={() => props.onPurpose(1)}>영수</button>
          <button type="button" className={`rounded-r-md px-3 py-1.5 font-semibold ${props.purpose === 2 ? 'bg-gray-900 text-white' : 'text-gray-600'}`} disabled={readOnly} onClick={() => props.onPurpose(2)}>청구</button>
        </div>
      </div>

      {lines.map((line, index) => (
        <div key={index} className="rounded-xl bg-white ring-1 ring-gray-200">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs font-bold text-gray-700">품목 {index + 1}</span>
            <span className="num text-xs text-gray-400">{line.month || '—'}/{line.day || '—'}</span>
            {readOnly || lines.length < 2 ? null : (
              <button type="button" className="text-gray-300 hover:text-red-600" aria-label="품목 삭제" onClick={() => props.onRemoveLine(index)}>✕</button>
            )}
          </div>
          <div className="space-y-2 border-t border-gray-100 px-3 py-3">
            <input className="h-11 w-full rounded-lg px-3 font-medium ring-1 ring-gray-300" aria-label="품목" placeholder="품목명" value={line.name} readOnly={readOnly} onChange={(event) => props.onLine(index, { name: event.target.value })} />
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <input className="num h-11 rounded-lg px-3 text-right ring-1 ring-gray-300" inputMode="numeric" aria-label="수량" value={line.qty} readOnly={readOnly} onChange={(event) => props.onLine(index, { qty: event.target.value.replace(/\D/g, '') })} />
              <input className="num h-11 rounded-lg px-3 text-right ring-1 ring-gray-300" inputMode="numeric" aria-label="단가" value={line.unitPrice} readOnly={readOnly} onChange={(event) => props.onLine(index, { unitPrice: formatMoneyInput(event.target.value) })} />
            </div>
            <p className="num flex justify-between text-[13px] text-gray-500"><span>공급가액 {won(lineSupply(line))}</span>{exempt ? null : <span>세액 {won(lineTax(line, taxKind))}</span>}</p>
          </div>
          {index === lines.length - 1 && !readOnly ? (
            <button type="button" className="w-full border-t border-dashed border-gray-200 py-2.5 text-[13px] font-medium text-gray-500" disabled={lines.length >= 16} onClick={props.onAddLine}>＋ 품목 추가</button>
          ) : null}
        </div>
      ))}

      <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-gray-200">
        <div className="num flex justify-between text-[13px] text-gray-500"><span>공급가액</span><span>{won(props.supplySum)}</span></div>
        {exempt ? null : <div className="num flex justify-between text-[13px] text-gray-500"><span>세액</span><span>{won(props.taxSum)}</span></div>}
        <div className="num mt-1.5 flex items-baseline justify-between border-t border-gray-100 pt-2">
          <span className="text-[13px] font-medium">합계금액</span>
          <span className="text-2xl font-bold">{won(props.totalSum)}<span className="text-base">원</span></span>
        </div>
      </div>
    </div>
  );
}
