import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LineMdIcon } from '../ui/LineMdIcon';
import {
  TAX_FORM_MAX_LINES,
  formatBizInput,
  formatMoneyInput,
  won,
  type TaxFormLine,
  type TaxParty,
} from './taxInvoiceFormModel';

const CELL =
  'w-full min-w-0 border-0 border-b border-slate-400 bg-transparent px-0.5 py-1 text-center text-fluid-2xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60';
const CARD_INPUT =
  'mt-1 block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export type TaxFormProps = {
  readOnly: boolean;
  supplier: TaxParty;
  buyer: TaxParty;
  onBuyer: (patch: Partial<TaxParty>) => void;
  corpState: 'ok' | 'bad' | 'empty';
  writeDate: string;
  dates: string[];
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
  supplierOpen: boolean;
  onSupplierOpen: (open: boolean) => void;
  extraOpen: boolean;
  onExtraOpen: (open: boolean) => void;
};

function Cell({
  value,
  onChange,
  readOnly,
  numeric,
  digits,
  label,
  bad,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  numeric?: boolean;
  digits?: boolean;
  label: string;
  bad?: boolean;
}) {
  if (readOnly) return <span className="block truncate text-center text-fluid-2xs text-slate-900" title={value}>{value || '—'}</span>;
  return (
    <input
      className={`${CELL} ${bad ? 'border-b-red-600 text-red-700' : ''}`}
      value={value}
      aria-label={label}
      inputMode={numeric || digits ? 'numeric' : undefined}
      onChange={(event) => onChange(numeric ? formatMoneyInput(event.target.value) : digits ? event.target.value.replace(/\D/g, '') : event.target.value)}
    />
  );
}

function PartyCells({
  party,
  readOnly,
  onChange,
  corpState,
}: {
  party: TaxParty;
  readOnly: boolean;
  onChange?: (patch: Partial<TaxParty>) => void;
  corpState?: 'ok' | 'bad' | 'empty';
}) {
  const locked = readOnly || !onChange;
  return (
    <>
      <tr>
        <th className="w-16 px-1 py-1 text-center text-fluid-2xs font-medium">등록번호</th>
        <td className="px-1 py-1">
          <div className="flex items-center gap-1">
            <Cell value={formatBizInput(party.corpNum)} readOnly={locked} label="등록번호" bad={corpState === 'bad'} onChange={(value) => onChange?.({ corpNum: value })} />
            {corpState === 'ok' ? <span className="text-fluid-2xs text-emerald-700">✓</span> : null}
          </div>
        </td>
        <th className="w-16 px-1 py-1 text-center text-fluid-2xs font-medium">종사업장</th>
        <td className="w-20 px-1 py-1">
          <Cell value={party.taxRegId} readOnly={locked} digits label="종사업장번호" onChange={(value) => onChange?.({ taxRegId: value.slice(0, 10) })} />
        </td>
      </tr>
      <tr>
        <th className="px-1 py-1 text-center text-fluid-2xs font-medium">상호</th>
        <td className="px-1 py-1"><Cell value={party.corpName} readOnly={locked} label="상호" onChange={(value) => onChange?.({ corpName: value })} /></td>
        <th className="px-1 py-1 text-center text-fluid-2xs font-medium">성명</th>
        <td className="px-1 py-1"><Cell value={party.ceoName} readOnly={locked} label="성명" onChange={(value) => onChange?.({ ceoName: value })} /></td>
      </tr>
      <tr>
        <th className="px-1 py-1 text-center text-fluid-2xs font-medium">주소</th>
        <td className="px-1 py-1" colSpan={3}><Cell value={party.addr} readOnly={locked} label="주소" onChange={(value) => onChange?.({ addr: value })} /></td>
      </tr>
      <tr>
        <th className="px-1 py-1 text-center text-fluid-2xs font-medium">업태</th>
        <td className="px-1 py-1"><Cell value={party.bizType} readOnly={locked} label="업태" onChange={(value) => onChange?.({ bizType: value })} /></td>
        <th className="px-1 py-1 text-center text-fluid-2xs font-medium">종목</th>
        <td className="px-1 py-1"><Cell value={party.bizClass} readOnly={locked} label="종목" onChange={(value) => onChange?.({ bizClass: value })} /></td>
      </tr>
      <tr>
        <th className="px-1 py-1 text-center text-fluid-2xs font-medium">이메일</th>
        <td className="px-1 py-1" colSpan={3}><Cell value={party.email} readOnly={locked} label="이메일" onChange={(value) => onChange?.({ email: value })} /></td>
      </tr>
    </>
  );
}

export function TaxInvoiceSheet(props: TaxFormProps) {
  const { readOnly, supplier, buyer, lines } = props;
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-slate-900">
        <caption className="mb-2 text-center text-fluid-sm font-semibold tracking-[0.3em] text-slate-900">전자세금계산서</caption>
        <tbody>
          <tr>
            <td className="w-1/2 border-2 border-red-600 p-1 align-top">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-fluid-2xs font-semibold text-red-700">공급자</p>
                {readOnly ? null : (
                  <Link to="/admin/team-leaders/cashbill" className="text-fluid-2xs text-slate-700 underline hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">수정</Link>
                )}
              </div>
              <table className="w-full"><tbody><PartyCells party={supplier} readOnly /></tbody></table>
            </td>
            <td className="w-1/2 border-2 border-blue-600 p-1 align-top">
              <p className="mb-1 text-fluid-2xs font-semibold text-blue-700">공급받는자</p>
              <table className="w-full">
                <tbody>
                  <PartyCells party={buyer} readOnly={readOnly} corpState={props.corpState} onChange={props.onBuyer} />
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <table className="mt-1 w-full min-w-[720px] border-collapse border border-slate-300 text-slate-900">
        <thead>
          <tr className="bg-slate-50 text-fluid-2xs">
            <th className="border border-slate-300 px-1 py-1 text-center">작성일자</th>
            <th className="border border-slate-300 px-1 py-1 text-center">공급가액</th>
            <th className="border border-slate-300 px-1 py-1 text-center">세액</th>
            <th className="border border-slate-300 px-1 py-1 text-center">비고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-1 py-1 text-center">
              {readOnly ? props.writeDate : (
                <select className={CELL} aria-label="작성일자" value={props.writeDate} onChange={(event) => props.onWriteDate(event.target.value)}>
                  {props.dates.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              )}
            </td>
            <td className="border border-slate-300 px-1 py-1 text-center text-fluid-2xs tabular-nums">{won(props.supplySum)}</td>
            <td className="border border-slate-300 px-1 py-1 text-center text-fluid-2xs tabular-nums">{won(props.taxSum)}</td>
            <td className="border border-slate-300 px-1 py-1">
              <Cell value={props.remark} readOnly={readOnly} label="비고" onChange={props.onRemark} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="w-full min-w-[720px] border-collapse border border-slate-300 text-slate-900">
        <thead>
          <tr className="bg-slate-50 text-fluid-2xs">
            {['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액', '비고', ''].map((label) => (
              <th key={label || 'remove'} className="border border-slate-300 px-1 py-1 text-center">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td className="border border-slate-300 px-1"><Cell value={line.month} readOnly={readOnly} digits label="월" onChange={(value) => props.onLine(index, { month: value.slice(0, 2) })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.day} readOnly={readOnly} digits label="일" onChange={(value) => props.onLine(index, { day: value.slice(0, 2) })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.name} readOnly={readOnly} label="품목" onChange={(value) => props.onLine(index, { name: value })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.spec} readOnly={readOnly} label="규격" onChange={(value) => props.onLine(index, { spec: value })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.qty} readOnly={readOnly} numeric label="수량" onChange={(value) => props.onLine(index, { qty: value })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.unitPrice} readOnly={readOnly} numeric label="단가" onChange={(value) => props.onLine(index, { unitPrice: value })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.supply} readOnly={readOnly} numeric label="공급가액" onChange={(value) => props.onLine(index, { supply: value })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.tax} readOnly={readOnly} numeric label="세액" onChange={(value) => props.onLine(index, { tax: value })} /></td>
              <td className="border border-slate-300 px-1"><Cell value={line.remark} readOnly={readOnly} label="품목 비고" onChange={(value) => props.onLine(index, { remark: value })} /></td>
              <td className="border border-slate-300 px-1 text-center">
                {readOnly || lines.length < 2 ? null : (
                  <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-label="품목 삭제" onClick={() => props.onRemoveLine(index)}>
                    <LineMdIcon name="close" className="size-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {readOnly || lines.length >= TAX_FORM_MAX_LINES ? null : (
        <button type="button" className="mt-1 min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={props.onAddLine}>+ 품목 추가</button>
      )}
      <table className="mt-1 w-full min-w-[720px] border-collapse border border-slate-300 text-slate-900">
        <thead>
          <tr className="bg-slate-50 text-fluid-2xs">
            {['합계금액', '현금', '수표', '어음', '외상미수금', '영수/청구'].map((label) => (
              <th key={label} className="border border-slate-300 px-1 py-1 text-center">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-1 py-1 text-center text-fluid-xs font-medium tabular-nums">{won(props.totalSum)}</td>
            <td className="border border-slate-300 px-1"><Cell value={props.cash} readOnly={readOnly} numeric label="현금" onChange={(value) => props.onMoney('cash', value)} /></td>
            <td className="border border-slate-300 px-1"><Cell value={props.chkBill} readOnly={readOnly} numeric label="수표" onChange={(value) => props.onMoney('chkBill', value)} /></td>
            <td className="border border-slate-300 px-1"><Cell value={props.note} readOnly={readOnly} numeric label="어음" onChange={(value) => props.onMoney('note', value)} /></td>
            <td className="border border-slate-300 px-1"><Cell value={props.credit} readOnly={readOnly} numeric label="외상미수금" onChange={(value) => props.onMoney('credit', value)} /></td>
            <td className="border border-slate-300 px-1 py-1 text-center">
              {readOnly ? (
                <span className="text-fluid-2xs">{props.purpose === 2 ? '청구' : '영수'}</span>
              ) : (
                <span className="inline-flex gap-1">
                  {([1, 2] as const).map((id) => (
                    <button key={id} type="button" className={`min-h-11 rounded-lg border px-2 text-fluid-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${props.purpose === id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`} onClick={() => props.onPurpose(id)}>
                      {id === 1 ? '영수' : '청구'}
                    </button>
                  ))}
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-fluid-2xs text-slate-600">
      {label}
      {children}
    </label>
  );
}

export function TaxInvoiceMobileCards(props: TaxFormProps) {
  const { supplier, buyer, readOnly, lines } = props;
  return (
    <div className="space-y-2">
      <section className="rounded-lg border border-slate-200 border-l-4 border-l-red-600 bg-white p-2">
        <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => props.onSupplierOpen(!props.supplierOpen)}>
          <span className="min-w-0">
            <span className="block text-fluid-2xs font-semibold text-red-700">공급자</span>
            <span className="block truncate text-fluid-xs text-slate-900">{supplier.corpName || '계산서 연결'} · {formatBizInput(supplier.corpNum) || '—'}</span>
          </span>
          <span className="shrink-0 text-fluid-2xs text-slate-500">{props.supplierOpen ? '접기' : '펼치기'}</span>
        </button>
        {props.supplierOpen ? (
          <div className="mt-2 space-y-1 text-fluid-xs text-slate-800">
            <p>성명 {supplier.ceoName || '—'}</p>
            <p>주소 {supplier.addr || '—'}</p>
            <p>업태 {supplier.bizType || '—'} · 종목 {supplier.bizClass || '—'}</p>
            <p className="break-all">이메일 {supplier.email || '—'}</p>
            <Link to="/admin/team-leaders/cashbill" className="inline-flex min-h-11 items-center text-fluid-xs underline">수정</Link>
          </div>
        ) : null}
      </section>
      <section className="space-y-2 rounded-lg border border-slate-200 border-l-4 border-l-blue-600 bg-white p-2">
        <p className="text-fluid-2xs font-semibold text-blue-700">공급받는자</p>
        <Field label="등록번호">
          <input className={`${CARD_INPUT} ${props.corpState === 'bad' ? 'border-red-600 text-red-700' : ''}`} inputMode="numeric" aria-label="등록번호" disabled={readOnly} value={formatBizInput(buyer.corpNum)} onChange={(event) => props.onBuyer({ corpNum: event.target.value })} />
          {props.corpState === 'ok' ? <span className="text-fluid-2xs text-emerald-700">✓</span> : null}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="상호"><input className={CARD_INPUT} aria-label="상호" disabled={readOnly} value={buyer.corpName} onChange={(event) => props.onBuyer({ corpName: event.target.value })} /></Field>
          <Field label="성명"><input className={CARD_INPUT} aria-label="성명" disabled={readOnly} value={buyer.ceoName} onChange={(event) => props.onBuyer({ ceoName: event.target.value })} /></Field>
        </div>
        <Field label="주소"><input className={CARD_INPUT} aria-label="주소" disabled={readOnly} value={buyer.addr} onChange={(event) => props.onBuyer({ addr: event.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="업태"><input className={CARD_INPUT} aria-label="업태" disabled={readOnly} value={buyer.bizType} onChange={(event) => props.onBuyer({ bizType: event.target.value })} /></Field>
          <Field label="종목"><input className={CARD_INPUT} aria-label="종목" disabled={readOnly} value={buyer.bizClass} onChange={(event) => props.onBuyer({ bizClass: event.target.value })} /></Field>
        </div>
        <Field label="이메일"><input className={CARD_INPUT} type="email" aria-label="이메일" disabled={readOnly} value={buyer.email} onChange={(event) => props.onBuyer({ email: event.target.value })} /></Field>
        <Field label="종사업장번호"><input className={CARD_INPUT} inputMode="numeric" aria-label="종사업장번호" disabled={readOnly} value={buyer.taxRegId} onChange={(event) => props.onBuyer({ taxRegId: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field>
      </section>
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
        <Field label="작성일자">
          <select className={CARD_INPUT} aria-label="작성일자" disabled={readOnly} value={props.writeDate} onChange={(event) => props.onWriteDate(event.target.value)}>
            {props.dates.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </Field>
        <div className="flex gap-2">
          {([1, 2] as const).map((id) => (
            <button key={id} type="button" disabled={readOnly} className={`min-h-11 flex-1 rounded-lg border text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 ${props.purpose === id ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`} onClick={() => props.onPurpose(id)}>
              {id === 1 ? '영수' : '청구'}
            </button>
          ))}
        </div>
      </section>
      {lines.map((line, index) => (
        <section key={index} className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
          <div className="flex items-center justify-between">
            <p className="text-fluid-xs font-medium text-slate-900">품목 {index + 1}</p>
            {readOnly || lines.length < 2 ? null : (
              <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-label="품목 삭제" onClick={() => props.onRemoveLine(index)}>
                <LineMdIcon name="close" className="size-4" />
              </button>
            )}
          </div>
          <Field label="품목"><input className={CARD_INPUT} aria-label="품목" disabled={readOnly} value={line.name} onChange={(event) => props.onLine(index, { name: event.target.value })} /></Field>
          <Field label="규격"><input className={CARD_INPUT} aria-label="규격" disabled={readOnly} value={line.spec} onChange={(event) => props.onLine(index, { spec: event.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="수량"><input className={CARD_INPUT} inputMode="numeric" aria-label="수량" disabled={readOnly} value={line.qty} onChange={(event) => props.onLine(index, { qty: formatMoneyInput(event.target.value) })} /></Field>
            <Field label="단가"><input className={CARD_INPUT} inputMode="numeric" aria-label="단가" disabled={readOnly} value={line.unitPrice} onChange={(event) => props.onLine(index, { unitPrice: formatMoneyInput(event.target.value) })} /></Field>
          </div>
          <p className="text-fluid-xs tabular-nums text-slate-800">공급가액 {line.supply || '0'} · 세액 {line.tax || '0'}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="공급가액"><input className={CARD_INPUT} inputMode="numeric" aria-label="공급가액" disabled={readOnly} value={line.supply} onChange={(event) => props.onLine(index, { supply: formatMoneyInput(event.target.value) })} /></Field>
            <Field label="세액"><input className={CARD_INPUT} inputMode="numeric" aria-label="세액" disabled={readOnly} value={line.tax} onChange={(event) => props.onLine(index, { tax: formatMoneyInput(event.target.value) })} /></Field>
          </div>
        </section>
      ))}
      {readOnly || lines.length >= TAX_FORM_MAX_LINES ? null : (
        <button type="button" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={props.onAddLine}>+ 품목 추가</button>
      )}
      <section className="rounded-lg border border-slate-200 bg-white p-2 text-fluid-xs text-slate-900">
        <p className="tabular-nums">공급가액 {won(props.supplySum)} · 세액 {won(props.taxSum)} · 합계 {won(props.totalSum)}</p>
        <button type="button" className="mt-1 min-h-11 text-fluid-xs text-slate-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => props.onExtraOpen(!props.extraOpen)}>
          {props.extraOpen ? '현금·수표·어음·외상미수금 / 비고 접기' : '현금·수표·어음·외상미수금 / 비고'}
        </button>
        {props.extraOpen ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="현금"><input className={CARD_INPUT} inputMode="numeric" aria-label="현금" disabled={readOnly} value={props.cash} onChange={(event) => props.onMoney('cash', formatMoneyInput(event.target.value))} /></Field>
            <Field label="수표"><input className={CARD_INPUT} inputMode="numeric" aria-label="수표" disabled={readOnly} value={props.chkBill} onChange={(event) => props.onMoney('chkBill', formatMoneyInput(event.target.value))} /></Field>
            <Field label="어음"><input className={CARD_INPUT} inputMode="numeric" aria-label="어음" disabled={readOnly} value={props.note} onChange={(event) => props.onMoney('note', formatMoneyInput(event.target.value))} /></Field>
            <Field label="외상미수금"><input className={CARD_INPUT} inputMode="numeric" aria-label="외상미수금" disabled={readOnly} value={props.credit} onChange={(event) => props.onMoney('credit', formatMoneyInput(event.target.value))} /></Field>
            <div className="col-span-2">
              <Field label="비고"><input className={CARD_INPUT} aria-label="비고" disabled={readOnly} value={props.remark} onChange={(event) => props.onRemark(event.target.value)} /></Field>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
