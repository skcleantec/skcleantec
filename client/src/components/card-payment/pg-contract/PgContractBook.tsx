import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignaturePad } from '../../e-contract/SignaturePad';
import { knockoutSealPaper } from '../../../utils/sealPaperKnockout';
import './pgContractPrint.css';
import { isChecked, PG_CONTRACT_PAGE_TOTAL, PG_PREVIEW_CONTRACT_NO, type ContractValues } from './pgContractChrome';
import { ContractPage1, ContractPage2, ContractPage3, ContractPage4 } from './pgContractPagesA';
import { ContractPage5, ContractPage6, ContractPage7, ContractPage8 } from './pgContractPagesB';

const SIGN_PAGE = 6;

type Props = {
  mode: 'preview' | 'sign' | 'read';
  values: ContractValues;
  onChange?: (key: string, value: string) => void;
  contractNo?: string;
  uploadBlob?: (blob: Blob, filename: string) => Promise<{ secureUrl: string }>;
  onSubmit?: () => void;
  busy?: boolean;
};

const PAGE_LABEL = [
  '',
  '신청서 · 수수료',
  '동의 · 제출 서류',
  '제1조~제4조',
  '제5조~제8조',
  '제9조~제15조',
  '제16조~서명',
  '실제 소유자',
  '금지 거래',
];

function gate(page: number, values: ContractValues): string | null {
  if (page === 1) {
    if (!values.pgBizKind) return '개인사업자 또는 법인을 선택해 주세요.';
    if (!values.pgTaxKind) return '과세 또는 면세를 선택해 주세요.';
    if (!values['[[EC_MERCHANT_NAME]]']?.trim()) return '상호를 적어 주세요.';
    if (!values['[[EC_BIZ_NO]]']?.trim()) return '사업자등록번호를 적어 주세요.';
    if (!values['[[EC_SIGNER_NAME]]']?.trim()) return '대표자를 적어 주세요.';
    if (!values['[[EC_SIGNER_PHONE]]']?.trim()) return '휴대폰을 적어 주세요.';
    if (!values['[[EC_SIGNER_ADDRESS]]']?.trim()) return '사업장 주소를 적어 주세요.';
  }
  if (page === 2 && !isChecked(values.pgPrivacy)) return '개인정보 수집에 동의함을 선택해야 다음 장으로 갑니다.';
  if (page === 2 && !isChecked(values.pgShare)) return '제3자 제공에 동의함을 선택해야 다음 장으로 갑니다.';
  if (page === SIGN_PAGE && !isChecked(values['[[EC_CHECK]]'])) return '계약 내용 동의를 체크해야 다음 장으로 갑니다.';
  return null;
}

export function PgContractBook({ mode, values, onChange, contractNo, uploadBlob, onSubmit, busy }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(0.55);
  const [hint, setHint] = useState<string | null>(null);
  const readOnly = mode === 'read';
  const number = contractNo?.trim() || PG_PREVIEW_CONTRACT_NO;
  const set = (key: string, value: string) => onChange?.(key, value);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const fit = () => {
      const sheetPx = (210 / 25.4) * 96;
      setScale(Math.min(1, Math.max(0.35, (el.clientWidth - 4) / sheetPx)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sheet = (n: number) => {
    const common = { values, set, readOnly, contractNo: number };
    if (n === 1) return <ContractPage1 {...common} />;
    if (n === 2) return <ContractPage2 {...common} />;
    if (n === 3) return <ContractPage3 contractNo={number} />;
    if (n === 4) return <ContractPage4 contractNo={number} />;
    if (n === 5) return <ContractPage5 contractNo={number} />;
    if (n === 6) return <ContractPage6 {...common} />;
    if (n === 7) return <ContractPage7 {...common} />;
    return <ContractPage8 contractNo={number} />;
  };

  const go = (next: number) => {
    if (mode === 'sign' && next > page) {
      const problem = gate(page, values);
      if (problem) {
        setHint(problem);
        return;
      }
    }
    setHint(null);
    setPage(next);
  };

  const saveImage = async (blob: Blob, key: string, filename: string) => {
    if (uploadBlob) {
      const up = await uploadBlob(blob, filename);
      set(key, up.secureUrl);
      return;
    }
    set(key, URL.createObjectURL(blob));
  };

  return (
    <div className="pg-screen-root">
      {createPortal(
        <div className="pg-print-root">
          {Array.from({ length: PG_CONTRACT_PAGE_TOTAL }, (_, index) => (
            <div key={index}>{sheet(index + 1)}</div>
          ))}
        </div>,
        document.body,
      )}
      <div className="pg-no-print mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          이전
        </button>
        <span className="text-sm font-medium tabular-nums text-slate-900">
          {page} / {PG_CONTRACT_PAGE_TOTAL}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{PAGE_LABEL[page]}</span>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          disabled={page >= PG_CONTRACT_PAGE_TOTAL}
          onClick={() => go(page + 1)}
        >
          다음
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          onClick={() => window.print()}
        >
          전체 인쇄
        </button>
        {mode === 'sign' && page === PG_CONTRACT_PAGE_TOTAL && onSubmit ? (
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={busy}
            onClick={onSubmit}
          >
            계약 제출
          </button>
        ) : null}
      </div>
      {hint ? <p className="pg-no-print mb-2 text-sm text-red-700">{hint}</p> : null}
      <div ref={hostRef} className="pg-scale-host" style={{ height: `${297 * scale}mm` }}>
        <div className="pg-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: '210mm' }}>
          {sheet(page)}
        </div>
      </div>
      {page === SIGN_PAGE && !readOnly ? (
        <div className="pg-no-print mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">이 장의 도장과 서명</p>
          <label className="block text-sm text-slate-700">
            도장 사진
            <input
              type="file"
              accept="image/*"
              className="mt-1 block text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void knockoutSealPaper(file, 36)
                  .then((blob) => saveImage(blob, '[[EC_SEAL]]', 'seal.png'))
                  .catch(() => saveImage(file, '[[EC_SEAL]]', file.name || 'seal.png'));
              }}
            />
          </label>
          <SignaturePad
            canvasHeightClass="h-28"
            onSave={(blob) => saveImage(blob, '[[EC_SIGNATURE]]', `signature_${Date.now()}.png`)}
            onClear={() => set('[[EC_SIGNATURE]]', '')}
          />
        </div>
      ) : null}
    </div>
  );
}
