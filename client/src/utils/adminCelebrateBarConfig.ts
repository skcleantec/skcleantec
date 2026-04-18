import type { InquiryCelebratePayload } from '../hooks/useInboxRealtime';

const KEY_ORDER = 'skcleantec_celebrate_bar_tpl_order';
const KEY_DEFAULT = 'skcleantec_celebrate_bar_tpl_default';

export const CELEBRATE_BAR_PLACEHOLDER_HELP =
  '사용 가능: {{registrarName}}(접수자), {{customerName}}(고객), {{source}}(출처), {{inquiryNumber}}(접수번호)';

export const DEFAULT_CELEBRATE_TPL_ORDER =
  '{{registrarName}}님이 {{customerName}}님의 발주서가 접수되었습니다 👏👏👏';

export const DEFAULT_CELEBRATE_TPL_INQUIRY =
  '{{registrarName}}님이 {{customerName}}님 건을 접수했습니다 👏👏👏';

const MAX_LEN = 500;

function clip(s: string): string {
  const t = s.trim();
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t;
}

export function getCelebrateBarTemplates(): { orderForm: string; inquiry: string } {
  let orderForm = DEFAULT_CELEBRATE_TPL_ORDER;
  let inquiry = DEFAULT_CELEBRATE_TPL_INQUIRY;
  try {
    const o = localStorage.getItem(KEY_ORDER);
    if (o && o.trim()) orderForm = clip(o);
  } catch {
    /* ignore */
  }
  try {
    const d = localStorage.getItem(KEY_DEFAULT);
    if (d && d.trim()) inquiry = clip(d);
  } catch {
    /* ignore */
  }
  return { orderForm, inquiry };
}

export function setCelebrateBarTemplates(orderForm: string, inquiry: string): void {
  try {
    localStorage.setItem(KEY_ORDER, clip(orderForm));
    localStorage.setItem(KEY_DEFAULT, clip(inquiry));
  } catch {
    /* Safari 사설 모드 등 */
  }
}

export function clearCelebrateBarTemplates(): void {
  try {
    localStorage.removeItem(KEY_ORDER);
    localStorage.removeItem(KEY_DEFAULT);
  } catch {
    /* ignore */
  }
}

function isOrderFormSource(source: string | null | undefined): boolean {
  const s = (source ?? '').trim();
  return s === '발주서' || s.includes('발주');
}

function subst(tpl: string, key: string, val: string): string {
  return tpl.split(key).join(val);
}

/** 접수 축하 상단 바에 표시할 한 줄 문구 */
export function formatCelebrateBannerFromConfig(p: InquiryCelebratePayload): string {
  const { orderForm, inquiry } = getCelebrateBarTemplates();
  const tpl = isOrderFormSource(p.source) ? orderForm : inquiry;
  let out = tpl;
  out = subst(out, '{{registrarName}}', (p.registrarName ?? '').trim() || '담당');
  out = subst(out, '{{customerName}}', (p.customerName ?? '').trim() || '고객');
  out = subst(out, '{{source}}', (p.source ?? '').trim() || '');
  out = subst(out, '{{inquiryNumber}}', (p.inquiryNumber ?? '').trim() || '');
  return out;
}
