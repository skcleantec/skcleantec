import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * 목록 필터 줄 — UI 규칙 v2 (docs/design/ui-rules.md §필터 줄)
 * 순서: ① 기간(FilterSegment) → ② 기준 → ③ 자주 쓰는 필터 최대 4개(FilterSelect) → ④ 필터 더보기 → ⑤ 검색(FilterSearch)
 * - 칸 높이 36, 고르면 바로 적용(조회 버튼 없음)
 * - 모바일(<lg): 기간·검색만 보이고, 나머지(children·more)는 「필터 · N」 버튼 → 아래 시트
 */

const BOX = 'h-9 rounded-lg border bg-white text-fluid-xs';

export function FilterBar({
  period,
  search,
  children,
  more,
  activeCount = 0,
  chips,
}: {
  /** ① 기간 세그먼트 등 — 항상 보임 */
  period?: ReactNode;
  /** ⑤ 검색칸 — 항상 보임 */
  search?: ReactNode;
  /** ②③ 기준·자주 쓰는 필터 — PC는 한 줄, 모바일은 시트 */
  children?: ReactNode;
  /** ④ 덜 쓰는 필터 — PC는 「필터 더보기」를 눌러야 펼침, 모바일은 시트 아래쪽 */
  more?: ReactNode;
  /** 걸린 필터 개수(기본값과 다른 것) — 모바일 버튼에 표시 */
  activeCount?: number;
  /** 걸린 필터 칩 줄(ActiveFilters) */
  chips?: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {period}
        <div className="hidden lg:contents">
          {children}
          {more ? (
            <Button size="md" variant="quiet" className="!text-[#2563eb]" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
              {moreOpen ? '필터 접기' : '필터 더보기'}
            </Button>
          ) : null}
        </div>
        {search ? <div className="min-w-[12rem] flex-1">{search}</div> : null}
        {children || more ? (
          <Button size="md" variant="secondary" className="lg:hidden" onClick={() => setSheetOpen(true)}>
            필터{activeCount > 0 ? ` · ${activeCount}` : ''}
          </Button>
        ) : null}
      </div>
      {more && moreOpen ? <div className="hidden flex-wrap items-center gap-2 lg:flex">{more}</div> : null}
      {chips}
      {sheetOpen ? (
        <div
          className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end bg-slate-900/40 lg:hidden"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="필터" className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white">
            <div className="flex h-12 items-center border-b border-slate-200 px-4">
              <span className="text-fluid-base font-bold text-slate-900">필터</span>
              <div className="flex-1" />
              <Button size="sm" variant="quiet" icon aria-label="닫기" onClick={() => setSheetOpen(false)}>✕</Button>
            </div>
            <div className="flex flex-col gap-3 p-4 [&>*]:w-full [&_label]:w-full [&_label]:max-w-none">
              {children}
              {more}
            </div>
            <div className="border-t border-slate-200 p-3">
              <Button size="lg" variant="primary" className="w-full" onClick={() => setSheetOpen(false)}>결과 보기</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** ① 기간 등 세그먼트 */
export function FilterSegment<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          className={`h-[30px] whitespace-nowrap rounded-md px-3 text-fluid-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${value === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** ②③ 「이름 값 ▾」 모양 셀렉트. 기본값(defaultValue)과 다르면 파란 바탕 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  defaultValue = '',
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  defaultValue?: string;
}) {
  const active = value !== defaultValue;
  return (
    <label className={`relative inline-flex min-w-0 max-w-[12rem] items-center gap-1.5 pl-3 pr-7 ${BOX} ${active ? 'border-[#93b4f5] bg-[#eff4ff]' : 'border-slate-200'}`}>
      <span className="shrink-0 text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 max-w-full cursor-pointer appearance-none truncate bg-transparent font-medium text-slate-900 outline-none"
      >
        {options.map(([id, text]) => <option key={id || 'all'} value={id}>{text}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </label>
  );
}

/** ⑤ 검색칸 — Enter나 0.4초 멈추면 적용 */
export function FilterSearch({
  value,
  onSearch,
  placeholder = '검색',
  debounceMs = 400,
}: {
  value: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [text, setText] = useState(value);
  const first = useRef(true);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (text.trim() === value.trim()) return;
    const t = window.setTimeout(() => onSearch(text.trim()), debounceMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <label className={`flex w-full items-center gap-2 px-3 text-slate-400 ${BOX} border-slate-200 focus-within:border-slate-400`}>
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch(text.trim());
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
      />
      {text ? (
        <button type="button" aria-label="검색어 지우기" className="text-slate-400 hover:text-slate-700" onClick={() => { setText(''); onSearch(''); }}>
          ✕
        </button>
      ) : null}
    </label>
  );
}

/** 걸린 필터 칩 줄 — 칩 ✕로 해제, 「모두 지우기」 */
export function ActiveFilters({ items, onClearAll }: { items: { key: string; label: string; onRemove: () => void }[]; onClearAll?: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-fluid-2xs text-slate-500">
      <span>적용된 필터</span>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onRemove}
          className="inline-flex h-[22px] items-center gap-1 rounded-full border border-[#b9cdf7] bg-[#e8f0ff] px-2 font-semibold text-[#1f4fb8] hover:bg-[#dbe7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93b4f5]"
        >
          {item.label}
          <span aria-hidden>✕</span>
          <span className="sr-only">필터 해제</span>
        </button>
      ))}
      {onClearAll && items.length > 1 ? <Button size="sm" variant="quiet" className="!text-slate-500" onClick={onClearAll}>모두 지우기</Button> : null}
    </div>
  );
}
