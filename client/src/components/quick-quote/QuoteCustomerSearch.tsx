import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTelecrmCustomerLookup,
  type TelecrmCustomerCandidateDto,
  type TelecrmCustomerLookupDto,
} from '../../api/telecrm';
import { getToken } from '../../stores/auth';
import { INQUIRY_EDIT_STATUS_LABELS } from '../admin/inquiry-edit/inquiryEditConstants';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../constants/orderFollowupStatus';
import { quoteCard } from './quoteChrome';

type Tone = 'green' | 'blue' | 'amber' | 'slate' | 'red';

const TONE: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-[#e8eefb] text-[#1f4fb8]',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
  red: 'bg-red-50 text-red-700',
};

type TimelineRow = { key: string; at: string; text: string; badge: string; tone: Tone };

function digitsOf(v: string) {
  return v.replace(/\D/g, '');
}

/** 숫자면 전화번호, 글자가 섞이면 이름 */
function readQuery(raw: string): { phone?: string; name?: string } | null {
  const q = raw.trim();
  if (!q) return null;
  if (/[가-힣a-zA-Z]/.test(q)) return q.length >= 2 ? { name: q } : null;
  const d = digitsOf(q);
  return d.length >= 4 ? { phone: d } : null;
}

function fmtPhone(raw: string) {
  const d = digitsOf(raw);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function md(iso: string | null | undefined) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${Number(m[2])}/${Number(m[3])}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
}

function inquiryTone(status: string): Tone {
  if (status === 'CANCELLED' || status === 'CANCEL_CONFIRMED') return 'red';
  if (status === 'COMPLETED') return 'slate';
  if (status === 'ON_HOLD' || status === 'PENDING' || status === 'ORDER_FORM_PENDING') return 'amber';
  return 'green';
}

function followupTone(status: string): Tone {
  if (status === 'ABSENT' || status === 'ON_HOLD') return 'amber';
  if (status === 'RESERVED' || status === 'FULFILLED') return 'green';
  return 'blue';
}

function buildTimeline(r: TelecrmCustomerLookupDto): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const i of r.inquiries) {
    const bits = [i.areaPyeong ? `${i.areaPyeong}평` : '', i.preferredDate ? `희망 ${md(i.preferredDate)}` : '']
      .filter(Boolean)
      .join(' · ');
    rows.push({
      key: `i-${i.id}`,
      at: i.createdAt,
      text: `접수${bits ? ` · ${bits}` : ''}`,
      badge: INQUIRY_EDIT_STATUS_LABELS[i.status] ?? i.status,
      tone: inquiryTone(i.status),
    });
  }
  for (const f of r.followups) {
    rows.push({
      key: `f-${f.id}`,
      at: f.createdAt,
      text: f.memo?.trim() ? f.memo.trim() : '부재·보류 등록',
      badge: ORDER_FOLLOWUP_STATUS_LABEL[f.status as OrderFollowupStatus] ?? f.status,
      tone: followupTone(f.status),
    });
  }
  for (const c of r.csReports) {
    rows.push({ key: `c-${c.id}`, at: c.createdAt, text: c.content?.trim() || 'C/S 접수', badge: 'C/S', tone: 'red' });
  }
  const quotes = r.sentQuotes?.length ? r.sentQuotes : r.latestQuote ? [r.latestQuote] : [];
  for (const q of quotes) {
    rows.push({ key: `q-${q.id}`, at: q.createdAt, text: '견적 보냄', badge: '견적', tone: 'blue' });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

/** 이 창을 띄운 청소비서 창이 있으면 그 창에서 열고, 없으면 새 탭 */
function openInCbiseo(path: string) {
  const opener = window.opener as Window | null;
  try {
    if (opener && !opener.closed && opener.location.origin === window.location.origin) {
      opener.location.href = path;
      opener.focus();
      return;
    }
  } catch {
    /* 다른 창이면 아래로 */
  }
  window.open(path, 'cbiseo-main');
}

const Icon = {
  search: (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  ),
  call: (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3l2 5-2 1.5a11 11 0 0 0 5.5 5.5L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  ),
};

function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const isDigits = /^\d+$/.test(digitsOf(needle)) && !/[가-힣a-zA-Z]/.test(needle);
  if (isDigits) {
    const d = digitsOf(needle);
    const tail = digitsOf(text).endsWith(d);
    if (!tail || d.length > 8) return <>{text}</>;
    // 끝자리만 강조
    let left = d.length;
    let cut = text.length;
    while (cut > 0 && left > 0) {
      cut -= 1;
      if (/\d/.test(text[cut]!)) left -= 1;
    }
    return (
      <>
        {text.slice(0, cut)}
        <mark className="rounded-sm bg-yellow-200/80 text-inherit">{text.slice(cut)}</mark>
      </>
    );
  }
  const at = text.indexOf(needle);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-yellow-200/80 text-inherit">{needle}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

export function QuoteCustomerSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const q = readQuery(value);
  const kind = q?.name ? '이름' : q?.phone ? '전화번호' : '';
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl bg-white px-2.5 text-slate-900 focus-within:ring-2 focus-within:ring-[#7fa2ec]">
      {Icon.search}
      <span className="sr-only">고객 찾기</span>
      <input
        ref={ref}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('');
        }}
        placeholder="이름·전화번호로 고객 찾기"
        className="min-w-0 flex-1 bg-transparent text-fluid-sm font-medium outline-none placeholder:font-normal placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {kind ? <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600">{kind}</span> : null}
      {value ? (
        <button
          type="button"
          aria-label="검색 지우기"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[13px] leading-none text-slate-600"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}

export function QuoteCustomerSearchResults({
  query,
  operatingCompanyId,
  top,
  onClose,
  onMakeQuote,
}: {
  query: string;
  operatingCompanyId: string;
  top: number;
  onClose: () => void;
  onMakeQuote: (pyeong: string) => void;
}) {
  const parsed = useMemo(() => readQuery(query), [query]);
  const [result, setResult] = useState<TelecrmCustomerLookupDto | null>(null);
  const [picked, setPicked] = useState<TelecrmCustomerLookupDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPicked(null);
    if (!parsed) {
      setResult(null);
      setError(null);
      return;
    }
    const token = getToken();
    if (!token) return;
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchTelecrmCustomerLookup(token, parsed, operatingCompanyId)
        .then((r) => {
          if (!alive) return;
          setResult(r);
          setError(null);
        })
        .catch((e) => {
          if (!alive) return;
          setError(e instanceof Error ? e.message : '고객을 찾지 못했어요.');
          setResult(null);
        })
        .finally(() => alive && setLoading(false));
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [operatingCompanyId, parsed]);

  const pick = (c: TelecrmCustomerCandidateDto) => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    fetchTelecrmCustomerLookup(token, { phone: c.customerPhone }, operatingCompanyId)
      .then(setPicked)
      .catch((e) => setError(e instanceof Error ? e.message : '고객을 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  };

  const detail = picked ?? (result?.match === 'existing' ? result : null);
  const candidates = !picked && result?.match === 'pick' ? result.candidates : [];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[35] mx-auto w-full max-w-[480px] overflow-y-auto overscroll-contain bg-canvas px-3 pt-2.5"
      style={{ top, paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      role="region"
      aria-label="고객 찾기 결과"
    >
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="text-fluid-2xs text-slate-500">
          {!parsed
            ? '이름은 2글자, 번호는 4자리부터 찾아요'
            : loading
              ? '찾는 중'
              : detail
                ? '1명 찾음'
                : candidates.length
                  ? `${candidates.length}명 찾음`
                  : ''}
        </p>
        <button type="button" className="text-fluid-2xs font-semibold text-slate-600" onClick={onClose}>
          닫기
        </button>
      </div>

      {error ? <p className="py-6 text-center text-fluid-sm text-red-600">{error}</p> : null}

      {picked ? (
        <button
          type="button"
          className="mb-2 px-0.5 text-fluid-2xs font-semibold text-[#1f4fb8]"
          onClick={() => setPicked(null)}
        >
          ‹ 목록으로
        </button>
      ) : null}

      {detail ? (
        <CustomerCard data={detail} query={query} onMakeQuote={onMakeQuote} />
      ) : candidates.length ? (
        <div className={`${quoteCard} divide-y divide-slate-100 overflow-hidden`}>
          {candidates.map((c) => (
            <button
              key={c.key}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:bg-slate-50"
              onClick={() => pick(c)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-fluid-sm font-bold text-slate-600">
                {(c.customerName || '?').slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-fluid-sm font-bold text-slate-900">
                  <Highlight text={c.customerName || '이름 없음'} q={query} />
                  {c.nickname ? <span className="ml-1 font-normal text-slate-400">{c.nickname}</span> : null}
                </span>
                <span className="block truncate text-fluid-2xs text-slate-500">
                  <Highlight text={fmtPhone(c.customerPhone)} q={query} />
                  {c.lastAddress ? ` · ${c.lastAddress}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-fluid-2xs text-slate-400">{md(c.latestAt)}</span>
            </button>
          ))}
        </div>
      ) : parsed && !loading && result && !error ? (
        <div className="py-10 text-center">
          <p className="text-fluid-sm font-semibold text-slate-800">찾는 고객이 없어요</p>
          <p className="mt-1 text-fluid-2xs text-slate-500">
            {result.otherBrand
              ? `「${result.otherBrand.name}」 브랜드에 기록이 있어요. 위에서 브랜드를 바꿔 보세요.`
              : parsed.phone && parsed.phone.length < 10
                ? '번호 전체(010 포함)로 다시 찾아 보세요.'
                : '이름이나 번호를 다시 확인해 주세요.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CustomerCard({
  data,
  query,
  onMakeQuote,
}: {
  data: TelecrmCustomerLookupDto;
  query: string;
  onMakeQuote: (pyeong: string) => void;
}) {
  const timeline = buildTimeline(data);
  const name = data.customer.name || '이름 없음';
  const phone = data.customer.phone || data.inquiries[0]?.customerPhone || data.followups[0]?.customerPhone || '';
  const latestInquiry = data.inquiries[0];
  const pyeong = latestInquiry?.areaPyeong ?? data.followups[0]?.areaPyeong ?? null;
  const address = data.customer.lastAddress || data.followups[0]?.address || null;
  const source = latestInquiry?.source || data.followups[0]?.leadSource || null;
  const openPath = latestInquiry
    ? `/admin/inquiries?openInquiry=${encodeURIComponent(latestInquiry.id)}`
    : '/admin/inquiries/followup';

  const act =
    'flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-bold touch-manipulation';

  return (
    <div className={`${quoteCard} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8eefb] text-fluid-base font-extrabold text-[#1f4fb8]">
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-fluid-base font-extrabold text-slate-900">
            <span className="truncate">
              <Highlight text={name} q={query} />
            </span>
            {data.customer.nickname ? (
              <span className="truncate text-fluid-2xs font-normal text-slate-400">{data.customer.nickname}</span>
            ) : null}
            {source ? (
              <span className="shrink-0 rounded-md bg-[#e8eefb] px-1.5 py-0.5 text-[10.5px] font-bold text-[#1f4fb8]">{source}</span>
            ) : null}
          </p>
          <p className="truncate text-fluid-2xs text-slate-500">
            <Highlight text={fmtPhone(phone)} q={query} />
            {address ? ` · ${address}` : ''}
            {pyeong ? ` ${pyeong}평` : ''}
          </p>
        </div>
      </div>

      {timeline.length ? (
        <ul className="px-3 pb-2">
          {timeline.map((row, idx) => (
            <li
              key={row.key}
              className={`grid grid-cols-[2.6rem_1fr_auto] items-baseline gap-2 py-1.5 text-fluid-2xs ${
                idx ? 'border-t border-dashed border-slate-200' : ''
              }`}
            >
              <span className="text-slate-500">{md(row.at)}</span>
              <span className="truncate text-slate-800">{row.text}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${TONE[row.tone]}`}>{row.badge}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
        <a href={`tel:${digitsOf(phone)}`} className={`${act} border-[#1f4fb8] bg-[#1f4fb8] text-white`}>
          {Icon.call}전화
        </a>
        <button
          type="button"
          className={`${act} border-slate-200 bg-white text-slate-900`}
          onClick={() => onMakeQuote(pyeong ? String(pyeong) : '')}
        >
          {Icon.quote}견적 만들기
        </button>
        <button
          type="button"
          className={`${act} border-slate-200 bg-white text-slate-900`}
          onClick={() => openInCbiseo(openPath)}
        >
          {Icon.open}청소비서
        </button>
      </div>
    </div>
  );
}
