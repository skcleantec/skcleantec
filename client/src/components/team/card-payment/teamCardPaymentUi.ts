/** 팀·업체 카드결제 화면 공통 토큰 (시안: #F4F6FA / #0F172A). */
export const PAY_BG = '#F4F6FA';
export const PAY_NAVY = '#0F172A';
export const PAY_TRUST = '#1D4ED8';
export const PAY_OK = '#15803D';
export const PAY_LINE = '#E2E8F0';
export const PAY_MUTED = '#64748B';
export const PAY_CARD_RADIUS = 'rounded-[18px]';
export const TEAM_PAY_SHEET_MAX = 'mx-auto w-full max-w-[390px]';
export const PAY_SHEET_MAX = TEAM_PAY_SHEET_MAX;

export const TEAM_PAY_OVERLAY =
  'fixed inset-0 z-[620] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4';

export const TEAM_PAY_DIALOG =
  `relative w-full max-w-[390px] rounded-t-[20px] border border-slate-200 bg-white p-4 shadow-xl sm:rounded-[20px]`;

export const TEAM_PAY_BTN =
  'flex h-[54px] w-full items-center justify-center gap-1.5 rounded-[14px] text-fluid-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export const TEAM_PAY_BTN_NAVY = `${TEAM_PAY_BTN} bg-[#0F172A] text-white hover:bg-slate-800`;

export const TEAM_PAY_BTN_GHOST =
  `${TEAM_PAY_BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`;

export const TEAM_PAY_FIELD =
  'login-field-input mt-1 w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-fluid-sm text-slate-900';

export const TEAM_PAY_LABEL = 'block text-fluid-2xs font-medium text-slate-600';

export const TEAM_PAY_CARD =
  `${PAY_CARD_RADIUS} border border-slate-200 bg-white p-4 shadow-sm`;

export const TEAM_PAY_FOOTER =
  'sticky bottom-0 z-20 border-t border-slate-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3';
