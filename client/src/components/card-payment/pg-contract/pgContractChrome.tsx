import type { ReactNode } from 'react';

export const PG_PREVIEW_CONTRACT_NO = 'SB-PG-00000000-0000';
export const PG_CONTRACT_PAGE_TOTAL = 16;

export type ContractValues = Record<string, string>;

type SheetProps = {
  page: number;
  contractNo: string;
  children: ReactNode;
};

export function ContractSheet({ page, contractNo, children }: SheetProps) {
  return (
    <article className="pg-sheet">
      <header className="pg-sheet-head">
        <span>청소비서</span>
        <span>카드결제 이용계약서</span>
        <span>계약번호 {contractNo}</span>
      </header>
      <div className="pg-sheet-body">{children}</div>
      <footer className="pg-sheet-foot">
        <span>주식회사 서비스브릿지 · 138-87-04035</span>
        <span>계약번호 {contractNo}</span>
        <span>
          {page} / {PG_CONTRACT_PAGE_TOTAL}
        </span>
      </footer>
    </article>
  );
}

export function Blank({
  value,
  onChange,
  readOnly,
  width = '36mm',
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  width?: string;
}) {
  return (
    <span className="pg-blank" style={{ minWidth: width }}>
      <input value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} aria-label="입력" />
    </span>
  );
}

export function isChecked(value: string | undefined) {
  return value === 'Y' || value === '■' || value === '1' || value === 'true';
}

export function Choice({
  on,
  label,
  readOnly,
  onPick,
}: {
  on: boolean;
  label: string;
  readOnly: boolean;
  onPick: () => void;
}) {
  return (
    <button type="button" className="pg-choice" disabled={readOnly} aria-pressed={on} onClick={onPick}>
      <span className="pg-mark">{on ? '■' : '□'}</span>
      {label}
    </button>
  );
}

export function LockFee() {
  return (
    <>
      <p>이 계약의 결제수단은 국내 신용카드(체크·직불 포함)입니다. 계좌이체, 가상계좌, 휴대폰, 상품권, 해외카드, 간편결제는 따로 합의한 때에만 열립니다.</p>
      <table className="pg-table">
        <tbody>
          <tr>
            <th>국내 신용카드 수수료</th>
            <td>3.3% (부가세 별도)</td>
          </tr>
          <tr>
            <th>영세 · 중소 우대</th>
            <td>
              영세 % <span className="pg-circled">중소1</span> % &nbsp; 중소2 % &nbsp; 중소3 %
            </td>
          </tr>
          <tr>
            <th>정산</th>
            <td>■ 일정산 D+ &nbsp;&nbsp; 일 &nbsp;&nbsp; □ 월 1회 (익월 8일, 전월 승인분)</td>
          </tr>
        </tbody>
      </table>
      <p className="pg-muted">수수료 3.3%, 중소1, 일정산은 이 서식에 고정되어 있습니다. 여신전문금융업법 제18조의3에 따라 영세·중소 구분은 반기마다 다시 매겨질 수 있습니다.</p>
    </>
  );
}
