import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CashbillSettings } from '../../api/cashbill';
import { cancelCashbillLinkRequest, requestCashbillLink } from '../../api/cashbill';
import { BAROBILL_USER_ID_MESSAGE, barobillUserIdError } from '@shared/barobillPolicy';
import { SupplierInfoModal } from '../taxinvoice/SupplierInfoModal';
import { CashbillCertRegisterModal } from './CashbillCertRegisterModal';
import { CashbillLinkForm } from './CashbillLinkForm';

const PRIMARY =
  'inline-flex min-h-10 items-center justify-center rounded-[9px] bg-[#111a2b] px-4 text-fluid-xs font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 max-sm:w-full';
const GHOST =
  'inline-flex min-h-10 items-center justify-center rounded-[9px] border border-[#dde3ea] bg-transparent px-4 text-fluid-xs font-medium text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 max-sm:w-full';
const LINK = 'whitespace-nowrap text-fluid-xs font-medium text-[#1f4fb8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2';
const CHIP = 'whitespace-nowrap rounded-full border px-2 py-0.5 text-fluid-2xs';
const INPUT =
  'min-h-10 w-full rounded-lg border border-[#dde3ea] bg-white px-3 text-fluid-xs text-[#141b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:opacity-50';

const CASH_PATH = '/admin/inquiries/receipts/cashbill';

type Brand = CashbillSettings['brands'][number];
type Member = NonNullable<Brand['member']>;

function maskBizTitle(raw: string): string {
  const head = raw.replace(/\D/g, '').slice(0, 3);
  if (head.length < 3) return '***-**-*****';
  return `${head}-**-*****`;
}

function formatKstStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}

function certUntil(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.slice(0, 10).replace(/-/g, '.');
}

function safeReason(member: Member): string | null {
  const reason = member.rejectReason?.trim();
  if (reason) return reason;
  const err = member.lastError?.trim() || '';
  if (!err || /LINK_REQUIRED|PENDING|콘솔|플랫폼에서|처리완료/.test(err)) return null;
  return err;
}

function Steps({
  items,
}: {
  items: { state: 'done' | 'now' | 'todo'; title: string; sub?: string }[];
}) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
      {items.map((item, index) => (
        <li key={item.title} className="grid grid-cols-[22px_1fr] items-start gap-2 text-fluid-xs">
          <span
            className={`grid size-[22px] place-items-center rounded-full border text-fluid-2xs font-bold ${
              item.state === 'done'
                ? 'border-[#126b3f] bg-[#126b3f] text-white'
                : item.state === 'now'
                  ? 'border-[#1f4fb8] text-[#1f4fb8]'
                  : 'border-[#dde3ea] text-[#5d6878]'
            }`}
          >
            {item.state === 'done' ? '✓' : index + 1}
          </span>
          <span>
            <b className={item.state === 'now' ? 'text-[#1f4fb8]' : 'text-[#141b26]'}>{item.title}</b>
            {item.sub ? <small className="block text-fluid-2xs text-[#5d6878]">{item.sub}</small> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CashbillBrandCard({
  brand,
  prefill,
  missing,
  canEditCompany,
  canRegister,
  onDone,
  onCert,
  onIssue,
}: {
  brand: Brand;
  prefill: CashbillSettings['prefill'];
  missing: CashbillSettings['missing'];
  canEditCompany: boolean;
  canRegister: boolean;
  onDone: (message: string) => void;
  onCert: (expireDate: string | null) => void;
  onIssue: () => void;
}) {
  const member = brand.member;
  const [certOpen, setCertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hint, setHint] = useState(member?.linkRequestUserIdHint ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const corpSource = member?.corpNum || (brand.isDefault ? prefill.corpNum : '');
  const corpTitle = corpSource ? maskBizTitle(corpSource) : '사업자번호 없음';
  const linkFlow = Boolean(
    member && (member.status === 'LINK_REQUIRED' || (brand.isDefault && (member.status === 'FAILED' || member.status === 'REJECTED'))),
  );
  const requested = Boolean(member?.status === 'LINK_REQUIRED' && member.linkRequestedAt);
  const active = member?.status === 'ACTIVE' && member.linked;
  const ready = Boolean(active && member?.certValid);
  const retry = Boolean(member && (member.status === 'FAILED' || member.status === 'REJECTED'));
  const extraRetry = Boolean(member && !brand.isDefault && (member.status === 'FAILED' || member.status === 'REJECTED'));
  const simplified = member?.taxType === '2';

  async function sendRequest() {
    if (!member) return;
    const invalid = barobillUserIdError(hint);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestCashbillLink(member.id, hint.trim());
      onDone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 요청을 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await cancelCashbillLinkRequest(member.id);
      onDone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 요청을 취소하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const chip = !member
    ? { text: '미연결', className: 'border-[#dde3ea] text-[#5d6878]' }
    : requested
      ? { text: '연결 처리 중', className: 'border-[#b9cdf7] bg-[#e8f0ff] text-[#1f4fb8]' }
      : linkFlow
        ? { text: '연결 요청 필요', className: 'border-[#f0d27a] bg-[#fff6dc] text-[#7a5300]' }
        : ready
          ? { text: '사용 가능', className: 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]' }
          : active
            ? { text: '연결됨', className: 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]' }
            : { text: '검토 중', className: 'border-[#dde3ea] text-[#5d6878]' };

  const step1 = formatKstStamp(member?.linkRequestedAt || member?.createdAt);
  const step2 = formatKstStamp(member?.reviewedAt || member?.updatedAt);

  return (
    <section className="grid max-w-[640px] gap-4 rounded-[14px] border border-[#dde3ea] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-fluid-sm text-[#141b26]">{brand.name}</b>
        <span className={`${CHIP} border-[#dde3ea] text-[#5d6878]`}>{brand.isDefault ? '기본 브랜드' : '추가 브랜드'}</span>
        <span className={`${CHIP} ${chip.className}`}>{chip.text}</span>
        <span className="text-fluid-xs tabular-nums text-[#5d6878]">{corpTitle}</span>
      </div>

      {!member || extraRetry ? (
        <>
          {!member ? <p className="text-fluid-2xs text-[#5d6878]">현금영수증·세금계산서를 발행하려면 바로빌 연결이 한 번 필요해요.</p> : null}
          <CashbillLinkForm
            brand={brand}
            prefill={prefill}
            missing={brand.isDefault ? missing : []}
            canEditCompany={canEditCompany}
            canRegister={canRegister}
            mode="join"
            onDone={onDone}
          />
        </>
      ) : null}

      {member && linkFlow && !requested ? (
        <>
          {retry && safeReason(member) ? <p className="text-fluid-xs text-[#b42318]">{safeReason(member)}</p> : null}
          <div className="grid gap-1.5 rounded-[10px] border border-[#f0d27a] bg-[#fff6dc] px-4 py-3.5">
            <strong className="text-fluid-xs text-[#141b26]">이미 바로빌을 쓰고 있는 사업자예요</strong>
            <p className="text-fluid-xs text-[#141b26]">이 사업자번호는 바로빌에 가입돼 있어서 자동으로 연결되지 않아요. 연결 요청을 보내 주시면 청소비서가 대신 연결해 드려요.</p>
          </div>
          <label className="grid gap-1 text-fluid-xs text-[#5d6878]">
            바로빌 아이디
            <input
              className={INPUT}
              value={hint}
              placeholder="예: clean_1234"
              maxLength={50}
              required
              disabled={busy}
              onChange={(e) => setHint(e.target.value)}
            />
          </label>
          <p className="text-fluid-2xs leading-snug text-[#5d6878]">
            아이디를 모르시나요? 바로빌 홈페이지(barobill.co.kr) 아이디 찾기에서 사업자번호로 찾을 수 있어요. 안 되면 대표자 본인이 바로빌 고객센터 1544-9256에 확인해 주세요.
          </p>
          {hint.trim() && barobillUserIdError(hint) ? <p className="text-fluid-xs text-[#b42318]">{BAROBILL_USER_ID_MESSAGE}</p> : null}
          {error ? <p className="text-fluid-xs text-[#b42318]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} disabled={busy || Boolean(barobillUserIdError(hint))} onClick={() => void sendRequest()}>
              {busy ? '보내는 중…' : retry ? '다시 요청하기' : '연결 요청하기'}
            </button>
          </div>
        </>
      ) : null}

      {member && requested ? (
        <>
          <div className="justify-self-start rounded-lg bg-[#111a2b] px-3 py-2 text-fluid-xs text-white" role="status">연결 요청을 보냈어요</div>
          <Steps
            items={[
              { state: 'done', title: '연결 요청', sub: step1 },
              { state: 'now', title: '청소비서 연결 처리', sub: '영업일 1일 안' },
              { state: 'todo', title: '공동인증서 등록', sub: '세금계산서용' },
              { state: 'todo', title: '발행 시작' },
            ]}
          />
          <div className="rounded-[10px] border border-[#b9cdf7] bg-[#e8f0ff] px-4 py-3.5 text-fluid-xs text-[#141b26]">
            <p>요청을 받았어요. 연결이 끝나면 <b>{member.contactEmail || '담당 이메일'}</b>으로 알려드리고, 이 화면에서 바로 이어서 진행할 수 있어요.</p>
          </div>
          {error ? <p className="text-fluid-xs text-[#b42318]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={GHOST} disabled={busy} onClick={() => void cancelRequest()}>
              {busy ? '취소 중…' : '요청 취소'}
            </button>
          </div>
        </>
      ) : null}

      {member && active && !ready ? (
        <>
          <Steps
            items={[
              { state: 'done', title: '연결 요청', sub: step1 },
              { state: 'done', title: '청소비서 연결 처리', sub: step2 },
              { state: 'now', title: '공동인증서 등록', sub: '세금계산서용' },
              { state: 'todo', title: '발행 시작' },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <span className={`${CHIP} border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]`}>현금영수증 발행 가능</span>
            <span className={`${CHIP} border-[#dde3ea] text-[#5d6878]`}>
              {simplified ? '세금계산서 · 간이과세자는 발행할 수 없습니다' : '세금계산서 · 인증서 필요'}
            </span>
          </div>
          {simplified ? null : (
            <div className="grid gap-1.5 rounded-[10px] border border-[#f0d27a] bg-[#fff6dc] px-4 py-3.5">
              <strong className="text-fluid-xs">세금계산서는 공동인증서를 등록하면 발행할 수 있어요</strong>
              <p className="text-fluid-xs">사업자 공동인증서(범용 또는 전자세금계산서용)가 저장된 PC에서 진행해 주세요. 새 창이 열려요.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {simplified ? null : (
              <button type="button" className={PRIMARY} onClick={() => setCertOpen(true)}>공동인증서 등록</button>
            )}
            <Link to={CASH_PATH} className={LINK}>현금영수증 발행하러 가기</Link>
          </div>
        </>
      ) : null}

      {member && ready ? (
        <>
          <div className="flex flex-wrap gap-2">
            <span className={`${CHIP} border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]`}>현금영수증 ✓</span>
            <span className={`${CHIP} border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]`}>
              {simplified ? '세금계산서 · 간이과세자는 발행할 수 없습니다' : '세금계산서 ✓'}
            </span>
            {member.certExpireDate ? (
              <span className={`${CHIP} border-[#dde3ea] text-[#5d6878]`}>인증서 {certUntil(member.certExpireDate)}까지</span>
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[#dde3ea] px-3.5 py-3">
            <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-fluid-xs">
              <dt className="text-fluid-2xs text-[#5d6878]">업태·종목</dt>
              <dd className="break-all">{member.bizType || '없음'} · {member.bizClass || '없음'}</dd>
              <dt className="text-fluid-2xs text-[#5d6878]">담당</dt>
              <dd className="break-all">{member.contactTel || '전화 없음'} · {member.contactEmail || '이메일 없음'}</dd>
            </dl>
            <button type="button" className={LINK} onClick={() => setEditOpen(true)}>연결 정보 수정</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {simplified ? null : (
              <button type="button" className={PRIMARY} onClick={onIssue}>세금계산서 발행</button>
            )}
            <Link to={CASH_PATH} className={GHOST}>현금영수증 발행</Link>
          </div>
        </>
      ) : null}

      {member && !linkFlow && !active && !extraRetry ? (
        <p className="text-fluid-xs text-[#5d6878]">검토 중입니다. 승인이 끝나면 이 화면에서 이어서 진행할 수 있어요.</p>
      ) : null}

      {editOpen && member ? (
        <SupplierInfoModal
          operatingCompanyId={brand.operatingCompanyId}
          corpNum={member.corpNum}
          initial={{
            corpName: member.corpName,
            ceoName: member.ceoName,
            addr: member.addr1,
            bizType: member.bizType,
            bizClass: member.bizClass,
            email: member.contactEmail,
            tel: member.contactTel,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            onDone('');
          }}
        />
      ) : null}
      {certOpen ? (
        <CashbillCertRegisterModal
          operatingCompanyId={brand.operatingCompanyId}
          onClose={() => setCertOpen(false)}
          onRegistered={(status) => onCert(status.expireDate)}
          onIssue={onIssue}
        />
      ) : null}
    </section>
  );
}
