import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignaturePad } from '../../e-contract/SignaturePad';
import { knockoutSealPaper } from '../../../utils/sealPaperKnockout';
import './pgContractPrint.css';
import {
  ContractSheet,
  isChecked,
  PG_PREVIEW_CONTRACT_NO,
  type ContractValues,
  type FlowBlock,
  type FlowGate,
} from './pgContractChrome';
import { contractBlocksA } from './pgContractPagesA';
import { contractBlocksB } from './pgContractPagesB';

type Props = {
  mode: 'preview' | 'sign' | 'read';
  values: ContractValues;
  onChange?: (key: string, value: string) => void;
  contractNo?: string;
  uploadBlob?: (blob: Blob, filename: string) => Promise<{ secureUrl: string }>;
  onSubmit?: () => void;
  busy?: boolean;
};

function packBlocks(nodes: HTMLElement[], limit: number): number[][] {
  const slices: number[][] = [];
  let current: number[] = [];
  let used = 0;
  nodes.forEach((node, index) => {
    const height = node.offsetHeight;
    if (current.length > 0 && used + height > limit) {
      slices.push(current);
      current = [index];
      used = height;
      return;
    }
    current.push(index);
    used += height;
  });
  if (current.length > 0) slices.push(current);
  return slices.length > 0 ? slices : [[]];
}

function sameSlices(left: number[][], right: number[][]) {
  return left.length === right.length && left.every((row, index) => row.join(',') === right[index]?.join(','));
}

function gateMessage(gates: Set<FlowGate>, values: ContractValues): string | null {
  if (gates.has('identity')) {
    if (!values.pgBizKind) return '개인사업자 또는 법인을 선택해 주세요.';
    if (!values.pgTaxKind) return '과세 또는 면세를 선택해 주세요.';
    if (!values['[[EC_MERCHANT_NAME]]']?.trim()) return '상호를 적어 주세요.';
    if (!values['[[EC_BIZ_NO]]']?.trim()) return '사업자등록번호를 적어 주세요.';
    if (!values['[[EC_SIGNER_NAME]]']?.trim()) return '대표자를 적어 주세요.';
    if (!values['[[EC_SIGNER_PHONE]]']?.trim()) return '휴대폰을 적어 주세요.';
    if (!values['[[EC_SIGNER_ADDRESS]]']?.trim()) return '사업장 주소를 적어 주세요.';
  }
  if (gates.has('privacy') && !isChecked(values.pgPrivacy)) return '개인정보 수집에 동의함을 선택해야 다음 장으로 갑니다.';
  if (gates.has('share') && !isChecked(values.pgShare)) return '제3자 제공에 동의함을 선택해야 다음 장으로 갑니다.';
  if (gates.has('sign') && !isChecked(values['[[EC_CHECK]]'])) return '계약 내용 동의를 체크해야 다음 장으로 갑니다.';
  return null;
}

function BlockList({ blocks, indexes }: { blocks: FlowBlock[]; indexes: number[] }) {
  return (
    <>
      {indexes.map((index) => (
        <div key={blocks[index]?.key ?? index} className="pg-block">
          {blocks[index]?.node}
        </div>
      ))}
    </>
  );
}

export function PgContractBook({ mode, values, onChange, contractNo, uploadBlob, onSubmit, busy }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const probeBodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(0.55);
  const [hint, setHint] = useState<string | null>(null);
  const [slices, setSlices] = useState<number[][]>([[]]);
  const readOnly = mode === 'read';
  const number = contractNo?.trim() || PG_PREVIEW_CONTRACT_NO;
  const set = (key: string, value: string) => onChange?.(key, value);
  const blocks = useMemo(
    () => [...contractBlocksA({ values, set, readOnly }), ...contractBlocksB({ values, set, readOnly })],
    [values, readOnly, onChange],
  );
  const total = Math.max(1, slices.length);
  const safePage = Math.min(page, total);
  const pageIndexes = slices[safePage - 1] ?? blocks.map((_, index) => index);
  const pageGates = new Set(pageIndexes.map((index) => blocks[index]?.gate).filter((gate): gate is FlowGate => Boolean(gate)));

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    const limit = (probeBodyRef.current?.clientHeight ?? 0) - 4;
    const nodes = measureRef.current ? ([...measureRef.current.children] as HTMLElement[]) : [];
    if (limit < 40 || nodes.length === 0) return;
    nodes.forEach((node) => {
      node.querySelectorAll('input, button, textarea, select').forEach((el) => {
        el.setAttribute('tabindex', '-1');
      });
    });
    const next = packBlocks(nodes, limit);
    setSlices((prev) => (sameSlices(prev, next) ? prev : next));
  }, [blocks]);

  const go = (next: number) => {
    if (mode === 'sign' && next > safePage) {
      const problem = gateMessage(pageGates, values);
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

  const sheet = (indexes: number[], sheetPage: number) => (
    <ContractSheet page={sheetPage} total={total} contractNo={number}>
      <BlockList blocks={blocks} indexes={indexes} />
    </ContractSheet>
  );

  return (
    <div className="pg-screen-root">
      <div className="pg-offscreen" aria-hidden>
        <article className="pg-sheet">
          <header className="pg-sheet-head">
            <span>청소비서</span>
            <span>카드결제 이용약관 · 전자계약</span>
            <span>계약번호</span>
          </header>
          <div ref={probeBodyRef} className="pg-sheet-body" />
          <footer className="pg-sheet-foot">
            <span>주식회사 서비스브릿지</span>
            <span>계약번호</span>
            <span>1</span>
          </footer>
        </article>
        <article className="pg-sheet pg-measure-sheet">
          <div ref={measureRef} className="pg-sheet-body">
            {blocks.map((item) => (
              <div key={item.key} className="pg-block">
                {item.node}
              </div>
            ))}
          </div>
        </article>
      </div>
      {createPortal(
        <div className="pg-print-root">
          {slices.map((indexes, index) => (
            <div key={indexes.join('-') || index}>{sheet(indexes, index + 1)}</div>
          ))}
        </div>,
        document.body,
      )}
      <div className="pg-no-print mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          disabled={safePage <= 1}
          onClick={() => go(safePage - 1)}
        >
          이전
        </button>
        <span className="text-sm font-medium tabular-nums text-slate-900">
          {safePage} / {total}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{blocks[pageIndexes[0] ?? 0]?.label}</span>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          disabled={safePage >= total}
          onClick={() => go(safePage + 1)}
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
        {mode === 'sign' && safePage === total && onSubmit ? (
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
          {sheet(pageIndexes, safePage)}
        </div>
      </div>
      {pageGates.has('sign') && !readOnly ? (
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
