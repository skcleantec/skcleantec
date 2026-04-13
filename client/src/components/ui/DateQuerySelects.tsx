import { useEffect, useState } from 'react';

/** 브라우저 네이티브 date/month 입력 대신 연·월·일을 숫자·「N월」로만 선택 (OS 영어 달력 표기 방지) */

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function parseYm(s: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const maxD = new Date(y, mo, 0).getDate();
  if (mo < 1 || mo > 12 || d < 1 || d > maxD) return null;
  return { y, m: mo, d };
}

function clampDay(y: number, m: number, d: number): number {
  const maxD = new Date(y, m, 0).getDate();
  return Math.min(Math.max(1, d), maxD);
}

function yearRange(min: number, max: number): number[] {
  const a: number[] = [];
  for (let i = min; i <= max; i++) a.push(i);
  return a;
}

export type YearMonthSelectProps = {
  value: string;
  onChange: (ym: string) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
  idPrefix?: string;
  disabled?: boolean;
};

/** 값 `YYYY-MM` — 연도 숫자 + `N월` 셀렉트 */
export function YearMonthSelect({
  value,
  onChange,
  className = '',
  minYear = 2020,
  maxYear = 2040,
  idPrefix = 'ym',
  disabled = false,
}: YearMonthSelectProps) {
  const p = parseYm(value);
  const t = new Date();
  const fy = t.getFullYear();
  const fm = t.getMonth() + 1;
  const y = p?.y ?? fy;
  const m = p?.m ?? fm;
  const years = yearRange(minYear, maxYear);

  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <select
        id={`${idPrefix}-y`}
        className="border border-gray-300 rounded px-2 py-1.5 text-fluid-sm tabular-nums"
        value={y}
        disabled={disabled}
        onChange={(e) => {
          const ny = Number(e.target.value);
          onChange(`${ny}-${pad2(m)}`);
        }}
        aria-label="연도"
      >
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
      <span className="text-fluid-sm text-gray-600">년</span>
      <select
        id={`${idPrefix}-m`}
        className="border border-gray-300 rounded px-2 py-1.5 text-fluid-sm"
        value={m}
        disabled={disabled}
        onChange={(e) => {
          const nm = Number(e.target.value);
          onChange(`${y}-${pad2(nm)}`);
        }}
        aria-label="월"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
          <option key={mo} value={mo}>
            {mo}월
          </option>
        ))}
      </select>
    </div>
  );
}

export type YmdSelectProps = {
  value: string;
  onChange: (ymd: string) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
  idPrefix?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** true면 미입력 가능 — 연·월·일 `—` 선택 시 빈 문자열 */
  allowEmpty?: boolean;
  /**
   * allowEmpty와 함께 쓸 때: 연·월·일을 모두 고른 뒤에만 onChange(YYYY-MM-DD).
   * (발주서 등에서 날짜 선택 전에 임의로 1일이 들어가지 않게 함)
   */
  emitOnCompleteOnly?: boolean;
};

type DraftYmd = { y: number | null; m: number | null; d: number | null };

/** 값 `YYYY-MM-DD` — 연·월·일 숫자 + `N월` */
export function YmdSelect({
  value,
  onChange,
  className = '',
  minYear = 2020,
  maxYear = 2040,
  idPrefix = 'ymd',
  disabled = false,
  readOnly = false,
  allowEmpty = false,
  emitOnCompleteOnly = false,
}: YmdSelectProps) {
  const dis = disabled || readOnly;
  const deferred = Boolean(allowEmpty && emitOnCompleteOnly);
  const [draft, setDraft] = useState<DraftYmd | null>(null);

  const rawParsed = parseYmd(value);
  const parsed =
    rawParsed != null
      ? {
          y: rawParsed.y,
          m: rawParsed.m,
          d: clampDay(rawParsed.y, rawParsed.m, rawParsed.d),
        }
      : null;
  const now = new Date();
  const empty = allowEmpty && !String(value).trim();

  useEffect(() => {
    if (!deferred) return;
    if (parseYmd(value)) setDraft(null);
  }, [value, deferred]);

  let y: number | null = parsed?.y ?? null;
  let m: number | null = parsed?.m ?? null;
  let d: number | null = parsed?.d ?? null;

  // deferred 모드에서 기존 value가 있어도 연·월 변경 시 draft가 보이도록 함
  if (deferred && draft != null) {
    y = draft.y;
    m = draft.m;
    d = draft.d;
  }

  if (!allowEmpty && (y == null || m == null || d == null)) {
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
  }

  if (empty && !deferred) {
    y = null;
    m = null;
    d = null;
  }

  if (deferred && !parsed && !draft) {
    y = null;
    m = null;
    d = null;
  }

  const maxDay = y && m ? new Date(y, m, 0).getDate() : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const years = yearRange(minYear, maxYear);

  const emit = (ny: number, nm: number, nd: number) => {
    onChange(`${ny}-${pad2(nm)}-${pad2(clampDay(ny, nm, nd))}`);
  };

  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      <select
        id={`${idPrefix}-y`}
        className="border border-gray-300 rounded px-2 py-1.5 text-fluid-sm tabular-nums min-w-0"
        value={y ?? ''}
        disabled={dis}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            if (allowEmpty) {
              onChange('');
              if (deferred) setDraft(null);
            }
            return;
          }
          const ny = Number(v);
          if (deferred) {
            setDraft({ y: ny, m: null, d: null });
            return;
          }
          const nm = m ?? 1;
          const nd = d ?? 1;
          emit(ny, nm, nd);
        }}
        aria-label="연도"
      >
        {allowEmpty && <option value="">—</option>}
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
      <span className="text-fluid-sm text-gray-600">년</span>
      <select
        id={`${idPrefix}-m`}
        className="border border-gray-300 rounded px-2 py-1.5 text-fluid-sm min-w-0"
        value={y == null ? '' : deferred ? (m ?? '') : (m ?? 1)}
        disabled={dis || y == null}
        onChange={(e) => {
          const raw = e.target.value;
          if (deferred) {
            if (raw === '' || y == null) return;
            const nm = Number(raw);
            setDraft({ y, m: nm, d: null });
            return;
          }
          const nm = Number(raw);
          const ny = y!;
          const nd = d ?? 1;
          emit(ny, nm, clampDay(ny, nm, nd));
        }}
        aria-label="월"
      >
        {(y == null || (deferred && m == null)) && allowEmpty && <option value="">—</option>}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
          <option key={mo} value={mo}>
            {mo}월
          </option>
        ))}
      </select>
      <span className="text-fluid-sm text-gray-600">월</span>
      <select
        id={`${idPrefix}-d`}
        className="border border-gray-300 rounded px-2 py-1.5 text-fluid-sm tabular-nums min-w-0"
        value={y == null || m == null ? '' : deferred ? (d ?? '') : (d ?? 1)}
        disabled={dis || y == null || m == null}
        onChange={(e) => {
          const raw = e.target.value;
          if (deferred) {
            if (raw === '' || y == null || m == null) return;
            const nd = Number(raw);
            emit(y, m, nd);
            setDraft(null);
            return;
          }
          const nd = Number(raw);
          emit(y!, m!, nd);
        }}
        aria-label="일"
      >
        {y == null || m == null ? (
          <option value="">—</option>
        ) : (
          <>
            {deferred && d == null && <option value="">—</option>}
            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </>
        )}
      </select>
      <span className="text-fluid-sm text-gray-600">일</span>
    </div>
  );
}
