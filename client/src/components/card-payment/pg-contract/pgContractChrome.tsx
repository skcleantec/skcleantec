import { useEffect, useState, type ReactNode } from 'react';

export const PG_PREVIEW_CONTRACT_NO = 'SB-PG-00000000-0000';

export type ContractValues = Record<string, string>;

export type PageProps = {
  values: ContractValues;
  set: (key: string, value: string) => void;
  readOnly: boolean;
};

export type FlowGate = 'identity' | 'privacy' | 'share' | 'sign';

export type FlowBlock = {
  key: string;
  label: string;
  gate?: FlowGate;
  node: ReactNode;
};

type SheetProps = {
  page: number;
  total: number;
  contractNo: string;
  children: ReactNode;
};

export function ContractSheet({ page, total, contractNo, children }: SheetProps) {
  return (
    <article className="pg-sheet">
      <header className="pg-sheet-head">
        <span>청소비서</span>
        <span>카드결제 이용약관 · 전자계약</span>
        <span>계약번호 {contractNo}</span>
      </header>
      <div className="pg-sheet-body">{children}</div>
      <footer className="pg-sheet-foot">
        <span>주식회사 서비스브릿지 · 138-87-04035</span>
        <span>계약번호 {contractNo}</span>
        <span>
          {page} / {total}
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
  fieldKey,
  tone,
  label,
  optional,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  width?: string;
  fieldKey?: string;
  tone?: 'biz';
  label?: string;
  optional?: boolean;
}) {
  return (
    <span
      className={tone === 'biz' ? 'pg-blank pg-blank-biz' : 'pg-blank'}
      style={{ minWidth: width }}
      data-pg-key={fieldKey}
      data-pg-label={label}
      data-pg-optional={optional ? '1' : undefined}
    >
      <input value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} aria-label={label || '입력'} />
    </span>
  );
}

export function ContractImage({
  src,
  alt,
  className,
  onError,
}: {
  src: string;
  alt: string;
  className: string;
  onError?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const url = src.trim();
  useEffect(() => setHidden(false), [url]);
  if (!url || hidden) return null;
  return (
    <img
      className={className}
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        setHidden(true);
        onError?.();
      }}
    />
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
  fieldKey,
  tone,
  group,
  gateLabel,
  accept,
}: {
  on: boolean;
  label: string;
  readOnly: boolean;
  onPick: () => void;
  fieldKey?: string;
  tone?: 'biz';
  group?: string;
  gateLabel?: string;
  accept?: boolean;
}) {
  return (
    <button
      type="button"
      className={tone === 'biz' ? 'pg-choice pg-choice-biz' : 'pg-choice'}
      disabled={readOnly}
      aria-pressed={on}
      data-pg-key={fieldKey ?? group}
      data-pg-group={group}
      data-pg-label={gateLabel}
      data-pg-accept={accept ? '1' : undefined}
      onClick={onPick}
    >
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
    </>
  );
}
