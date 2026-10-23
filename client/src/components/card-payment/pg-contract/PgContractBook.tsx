import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignaturePad } from '../../e-contract/SignaturePad';
import { knockoutSealPaper, knockoutWhiteInk } from '../../../utils/sealPaperKnockout';
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
  onClose?: () => void;
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

type GateProblem = { message: string; focusKey: string };

function hasSavedSignature(value: string | undefined) {
  return Boolean(value?.trim().startsWith('https://'));
}

function gateProblem(
  gates: Set<FlowGate>,
  values: ContractValues,
  requireSignature: boolean,
  finish = false,
): GateProblem | null {
  if (!values.pgBizKind) return { message: '개인사업자 또는 법인을 선택해 주세요.', focusKey: 'pgBizKind' };
  if (!values.pgTaxKind) return { message: '과세 또는 면세를 선택해 주세요.', focusKey: 'pgTaxKind' };
  if (!values['[[EC_MERCHANT_NAME]]']?.trim()) return { message: '상호가 비어 있어 다음으로 가지 않습니다.', focusKey: '[[EC_MERCHANT_NAME]]' };
  if (!values['[[EC_BIZ_NO]]']?.trim()) return { message: '사업자등록번호가 비어 있어 다음으로 가지 않습니다.', focusKey: '[[EC_BIZ_NO]]' };
  if (!values['[[EC_SIGNER_NAME]]']?.trim()) return { message: '대표자 이름이 비어 있어 다음으로 가지 않습니다.', focusKey: '[[EC_SIGNER_NAME]]' };
  if (!values['[[EC_SIGNER_PHONE]]']?.trim()) return { message: '휴대폰이 비어 있어 다음으로 가지 않습니다.', focusKey: '[[EC_SIGNER_PHONE]]' };
  if (!values['[[EC_SIGNER_ADDRESS]]']?.trim()) return { message: '사업장 주소가 비어 있어 다음으로 가지 않습니다.', focusKey: '[[EC_SIGNER_ADDRESS]]' };
  if ((finish || gates.has('privacy')) && !isChecked(values.pgPrivacy)) {
    return { message: '개인정보 수집에 동의함을 선택해야 다음 장으로 갑니다.', focusKey: 'pgPrivacy' };
  }
  if ((finish || gates.has('share')) && !isChecked(values.pgShare)) {
    return { message: '제3자 제공에 동의함을 선택해야 다음 장으로 갑니다.', focusKey: 'pgShare' };
  }
  if ((finish || gates.has('sign') || requireSignature) && !isChecked(values['[[EC_CHECK]]'])) {
    return { message: '계약 내용 동의를 체크해야 다음 장으로 갑니다.', focusKey: '[[EC_CHECK]]' };
  }
  if ((finish || gates.has('sign') || requireSignature) && !hasSavedSignature(values['[[EC_SIGNATURE]]'])) {
    return { message: '서명을 그려 저장해야 다음으로 갑니다. 이름만으로는 넘어가지 않습니다.', focusKey: '[[EC_SIGNATURE]]' };
  }
  return null;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) return node;
    node = node.parentElement;
  }
  return null;
}

function scanBlocks(blocks: HTMLElement[]): GateProblem | null {
  for (const block of blocks) {
    const inputs = block.querySelectorAll<HTMLInputElement>('[data-pg-key] input');
    for (const input of inputs) {
      const host = input.closest<HTMLElement>('[data-pg-key]');
      if (!host || host.dataset.pgOptional === '1' || input.value.trim()) continue;
      const label = host.dataset.pgLabel || '빈 칸';
      return { message: `「${label}」을 적어 주세요.`, focusKey: host.dataset.pgKey || '' };
    }
    const seen = new Set<string>();
    for (const button of block.querySelectorAll<HTMLButtonElement>('[data-pg-group]')) {
      const group = button.dataset.pgGroup;
      if (!group || seen.has(group)) continue;
      seen.add(group);
      const peers = [...block.querySelectorAll<HTMLButtonElement>(`[data-pg-group="${CSS.escape(group)}"]`)];
      const accepts = peers.filter((el) => el.dataset.pgAccept === '1');
      const picked = (accepts.length > 0 ? accepts : peers).some((el) => el.getAttribute('aria-pressed') === 'true');
      if (picked) continue;
      const label = button.dataset.pgLabel || '선택';
      return { message: `「${label}」을 선택해 주세요.`, focusKey: button.dataset.pgKey || group };
    }
  }
  return null;
}

function jumpToField(root: HTMLElement, key: string) {
  const escaped = CSS.escape(key);
  const el = root.querySelector<HTMLElement>(
    `.pg-scale-host [data-pg-key="${escaped}"], .pg-sign-tools [data-pg-key="${escaped}"]`,
  );
  if (!el) return;
  root.querySelectorAll('.pg-aim').forEach((node) => node.classList.remove('pg-aim'));
  el.classList.add('pg-aim');
  window.setTimeout(() => el.classList.remove('pg-aim'), 2400);
  const target = el.querySelector<HTMLElement>('input,button') ?? el;
  const rect = target.getBoundingClientRect();
  const parent = scrollParent(target);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    parent.scrollTo({
      top: Math.max(0, parent.scrollTop + rect.top - parentRect.top - parent.clientHeight / 2 + rect.height / 2),
      behavior,
    });
  } else {
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2),
      behavior,
    });
  }
  target.focus({ preventScroll: true });
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

function printContract() {
  const prev = document.title;
  document.title = '청소비서-카드결제-계약서';
  const restore = () => {
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

export function PgContractBook({ mode, values, onChange, contractNo, uploadBlob, onSubmit, onClose, busy }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const probeBodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(0.55);
  const [block, setBlock] = useState<GateProblem | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [jumpKey, setJumpKey] = useState<string | null>(null);
  const [slices, setSlices] = useState<number[][]>([[]]);
  const readOnly = mode === 'read';
  const showFinished = readOnly || previewing;
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

  const signBlockIndex = blocks.findIndex((item) => item.gate === 'sign');
  const signPage = slices.findIndex((row) => row.includes(signBlockIndex)) + 1;
  const requireSignature = signPage > 0 && safePage >= signPage;

  const blanksThrough = (through: number | 'all') => {
    const nodes = measureRef.current ? ([...measureRef.current.children] as HTMLElement[]) : [];
    const indexes = through === 'all' ? nodes.map((_, index) => index) : slices.slice(0, through).flat();
    return scanBlocks(indexes.map((index) => nodes[index]).filter((node): node is HTMLElement => Boolean(node)));
  };

  const go = (next: number) => {
    if (mode === 'sign' && next > safePage) {
      const problem = gateProblem(pageGates, values, requireSignature) ?? blanksThrough(safePage);
      if (problem) {
        setBlock(problem);
        return;
      }
    }
    setBlock(null);
    setPage(next);
  };

  const confirmBlock = () => {
    const problem = block;
    setBlock(null);
    if (!problem) return;
    if (measureRef.current) {
      const nodes = [...measureRef.current.children];
      const index = nodes.findIndex((node) => node.querySelector(`[data-pg-key="${CSS.escape(problem.focusKey)}"]`));
      if (index >= 0) {
        const found = slices.findIndex((row) => row.includes(index));
        if (found >= 0) setPage(found + 1);
      }
    }
    setJumpKey(problem.focusKey);
  };

  useEffect(() => {
    if (!jumpKey) return;
    const id = window.requestAnimationFrame(() => {
      const root = hostRef.current?.parentElement;
      if (root) jumpToField(root, jumpKey);
      setJumpKey(null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [jumpKey, safePage]);

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
      {showFinished ? (
        <div className="pg-no-print mb-3 flex flex-wrap items-center gap-2">
          {readOnly ? null : (
            <button
              type="button"
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setPreviewing(false)}
            >
              작성으로 돌아가기
            </button>
          )}
          <button
            type="button"
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={printContract}
          >
            인쇄
          </button>
          <button
            type="button"
            className="min-h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={printContract}
          >
            다운로드
          </button>
          {onClose ? (
            <button
              type="button"
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              onClick={onClose}
            >
              닫기
            </button>
          ) : null}
        </div>
      ) : (
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
          onClick={printContract}
        >
          전체 인쇄
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => {
            setPreviewing(true);
            document.querySelector('.pg-desk-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          완성본 미리보기
        </button>
        {mode === 'sign' && safePage === total && onSubmit ? (
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              const problem = gateProblem(pageGates, values, true, true) ?? blanksThrough('all');
              if (problem) {
                setBlock(problem);
                return;
              }
              onSubmit?.();
            }}
          >
            계약 제출
          </button>
        ) : null}
      </div>
      )}
      {block
        ? createPortal(
            <div className="pg-no-print fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="pg-gate-title"
                className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-lg"
              >
                <p id="pg-gate-title" className="text-sm font-semibold text-slate-900">
                  다음으로 넘어가지 않습니다
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{block.message}</p>
                <button
                  type="button"
                  autoFocus
                  className="mt-4 min-h-10 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={confirmBlock}
                >
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div ref={hostRef} className={showFinished ? 'pg-finished flex w-full flex-col gap-3' : 'pg-scale-host'} style={showFinished ? undefined : { height: `${297 * scale}mm` }}>
        {showFinished
          ? slices.map((indexes, index) => (
              <div key={indexes.join('-') || index} className="pg-scale-host" style={{ height: `${297 * scale}mm` }}>
                <div className="pg-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: '210mm' }}>
                  {sheet(indexes, index + 1)}
                </div>
              </div>
            ))
          : (
            <div className="pg-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: '210mm' }}>
              {sheet(pageIndexes, safePage)}
            </div>
          )}
      </div>
      {pageGates.has('sign') && !readOnly && !previewing ? (
        <div className="pg-sign-tools pg-no-print mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3" data-pg-key="[[EC_SIGNATURE]]">
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
            hint="도장 파일이 없으면 이 서명이 도장 자리에 들어갑니다. 흰 배경은 빼고 필체만 붙입니다."
            onSave={async (blob) => {
              const ink = await knockoutWhiteInk(blob);
              await saveImage(ink, '[[EC_SIGNATURE]]', `signature_${Date.now()}.png`);
            }}
            onClear={() => set('[[EC_SIGNATURE]]', '')}
          />
        </div>
      ) : null}
    </div>
  );
}
