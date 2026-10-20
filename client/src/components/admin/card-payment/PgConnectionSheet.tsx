import type { TenantPgCredentialSlot } from '../../../api/cardPayment';
import { LineMdIcon } from '../../ui/LineMdIcon';

export type SellerCenterView = {
  portalUrl: string;
  loginId: string;
  password: string;
  businessName: string;
};

function cell(label: string, value: string) {
  return (
    <div className="min-w-0 px-3 py-2">
      <p className="text-fluid-2xs text-slate-500">{label}</p>
      <p className="mt-0.5 break-all text-fluid-sm font-medium text-slate-900">{value || '—'}</p>
    </div>
  );
}

function slotLine(slot: TenantPgCredentialSlot | undefined) {
  if (!slot?.connected) return '아직 없음';
  return [
    slot.mid ? `MID ${slot.mid}` : null,
    slot.oid ? `OID ${slot.oid}` : null,
    slot.tidMasked ? `TID ${slot.tidMasked}` : null,
    slot.apiKeyLast4 ? `키 끝 ${slot.apiKeyLast4}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || '연결됨';
}

/** 관리자 PG 연동 — 가맹 정보와 판매자센터 로그인을 한 서식으로 보여 준다. */
export function PgConnectionSheet({
  businessName,
  keyin,
  link,
  seller,
}: {
  businessName: string;
  keyin?: TenantPgCredentialSlot;
  link?: TenantPgCredentialSlot;
  seller: SellerCenterView | null;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <LineMdIcon name="link" className="size-5 text-slate-700" />
        <h2 className="text-fluid-sm font-semibold text-slate-900">선샤인페이 판매자센터</h2>
      </div>
      <div className="grid sm:grid-cols-2">
        {cell('상호명', seller?.businessName || businessName)}
        {cell('접속주소', seller?.portalUrl || 'https://wspay.net')}
        {cell('아이디', seller?.loginId || '')}
        {cell('비밀번호', seller?.password || '')}
        {cell('수기결재', slotLine(keyin))}
        {cell('인증결재', slotLine(link))}
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-fluid-2xs leading-snug text-slate-500">
        당일 결재만 취소할 수 있습니다. 결제 내역의 결제 취소를 누르면 이 아이디로 판매자센터에 로그인된 창이 열립니다.
      </p>
    </section>
  );
}
