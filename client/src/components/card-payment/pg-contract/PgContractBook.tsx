import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignaturePad } from '../../e-contract/SignaturePad';
import { knockoutSealPaper } from '../../../utils/sealPaperKnockout';
import './pgContractPrint.css';
import { isChecked, PG_CONTRACT_PAGE_TOTAL, PG_PREVIEW_CONTRACT_NO, type ContractValues } from './pgContractChrome';
import {
  ContractPage1,
  ContractPage2,
  ContractPage3,
  ContractPage4,
  ContractPage5,
  ContractPage6,
} from './pgContractPagesA';
import {
  ContractPage7,
  ContractPage8,
  ContractPage9,
  ContractPage10,
  ContractPage11,
  ContractPage12,
  ContractPage13,
  ContractPage14,
  ContractPage15,
  ContractPage16,
} from './pgContractPagesB';

type Props = {
  mode: 'preview' | 'sign' | 'read';
  values: ContractValues;
  onChange?: (key: string, value: string) => void;
  contractNo?: string;
  uploadBlob?: (blob: Blob, filename: string) => Promise<{ secureUrl: string }>;
  onSubmit?: () => void;
  busy?: boolean;
};

function gate(page: number, values: ContractValues): string | null {
  if (page === 2) {
    if (!values.pgBizKind) return '개인사업자 또는 법인을 선택해 주세요.';
    if (!values.pgTaxKind) return '과세 또는 면세를 선택해 주세요.';
    if (!values['[[EC_MERCHANT_NAME]]']?.trim()) return '상호를 적어 주세요.';
    if (!values['[[EC_BIZ_NO]]']?.trim()) return '사업자등록번호를 적어 주세요.';
    if (!values['[[EC_SIGNER_NAME]]']?.trim()) return '대표자를 적어 주세요.';
    if (!values['[[EC_SIGNER_PHONE]]']?.trim()) return '휴대폰을 적어 주세요.';
    if (!values['[[EC_SIGNER_ADDRESS]]']?.trim()) return '사업장 주소를 적어 주세요.';
  }
  if (page === 5 && !isChecked(values.pgPrivacy)) return '개인정보 수집에 동의함을 선택해야 다음으로 갑니다.';
  if (page === 6 && !isChecked(values.pgShare)) return '제3자 제공에 동의함을 선택해야 다음으로 갑니다.';
  if (page === 12 && !isChecked(values['[[EC_CHECK]]'])) return '계약 내용 동의를 체크해야 다음으로 갑니다.';
  return null;
}

const PAGE_LABEL = [
  '',
  '계약 회사',
  '가맹점 정보',
  '담당자·정산 계좌',
  '수수료 3.3% · 일정산',
  '서류·개인정보',
  '제3자 제공',
  '전자서명 신청 · 제1조',
  '제3조~제6조',
  '제7조~제9조',
  '제10조~제15조',
  '제16조~제20조',
  '서명',
  '실제 소유자 1',
  '실제 소유자 2',
  '금지 품목',
  '보관 서류',
];

export function PgContractBook({ mode, values, onChange, contractNo, uploadBlob, onSubmit, busy }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
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
    if (n === 1) return <ContractPage1 contractNo={number} />;
    if (n === 2) return <ContractPage2 {...common} />;
    if (n === 3) return <ContractPage3 {...common} />;
    if (n === 4) return <ContractPage4 contractNo={number} />;
    if (n === 5) return <ContractPage5 {...common} />;
    if (n === 6) return <ContractPage6 {...common} />;
    if (n === 7) return <ContractPage7 contractNo={number} />;
    if (n === 8) return <ContractPage8 contractNo={number} />;
    if (n === 9) return <ContractPage9 contractNo={number} />;
    if (n === 10) return <ContractPage10 contractNo={number} />;
    if (n === 11) return <ContractPage11 contractNo={number} />;
    if (n === 12) return <ContractPage12 {...common} />;
    if (n === 13) return <ContractPage13 {...common} />;
    if (n === 14) return <ContractPage14 {...common} />;
    if (n === 15) return <ContractPage15 contractNo={number} />;
    return <ContractPage16 contractNo={number} />;
  };

  const go = (next: number) => {
    if (!readOnly && next > page) {
      const problem = gate(page, values);
      if (problem) {
        setHint(problem);
        return;
      }
    }
    setHint(null);
    setPage(next);
    pageRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <div className="pg-no-print sticky top-0 z-30 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2 py-2 shadow-sm">
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
        <span className="w-full text-xs text-slate-500">회사 정보 다음에 가맹점, 수수료 3.3%, 약관, 서명이 16쪽까지 이어집니다.</span>
      </div>
      <div ref={hostRef} className="pg-scale-host">
        <div className="pg-scale" style={{ ['--pg-zoom' as string]: String(scale) }}>
          {Array.from({ length: PG_CONTRACT_PAGE_TOTAL }, (_, index) => {
            const n = index + 1;
            return (
              <div
                key={n}
                className="pg-page-block"
                ref={(el) => {
                  pageRefs.current[n] = el;
                }}
              >
                {sheet(n)}
                {n === 12 && !readOnly ? (
                  <div className="pg-no-print mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">이 쪽의 도장과 서명</p>
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
          })}
        </div>
      </div>
      {hint ? <p className="pg-no-print mt-2 text-sm text-red-700">{hint}</p> : null}
      <div className="pg-no-print mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          이전
        </button>
        <span className="text-sm tabular-nums text-slate-600">
          {page} / {PG_CONTRACT_PAGE_TOTAL}
        </span>
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
    </div>
  );
}
