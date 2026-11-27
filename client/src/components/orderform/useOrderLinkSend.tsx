import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ALIMTALK_LMS_FREE_UNITS,
  ALIMTALK_UNIT_PRICE_LMS_KRW,
  alimtalkChargeStatusLabel,
} from '@shared/alimtalkPolicy';
import {
  OrderLinkAlimtalkError,
  getOrderLinkSendStatus,
  getOrderLinkSmsQuote,
  sendOrderFormOrderLinkAlimtalk,
  sendOrderFormOrderLinkSms,
  type OrderLinkSendInfo,
  type OrderLinkSmsQuote,
} from '../../api/orderform';
import { OrderLinkDialogShell as Shell, OrderLinkInfoBox as InfoBox } from './OrderLinkSendDialogs';

/** 발송에 필요한 발주서 정보만 */
export type OrderLinkSendTarget = {
  id: string;
  customerName: string;
  customerPhone?: string | null;
};

type Dialog =
  | { kind: 'alimtalk-ok'; order: OrderLinkSendTarget; chargeLabel: string }
  | { kind: 'alimtalk-fail'; order: OrderLinkSendTarget; reason: string; smsAvailable: boolean }
  | { kind: 'sms-confirm'; order: OrderLinkSendTarget }
  | { kind: 'sms-ok'; order: OrderLinkSendTarget; smsKind: 'SMS' | 'LMS'; chargeText: string }
  | { kind: 'sms-fail'; order: OrderLinkSendTarget; reason: string };

const POLL_GAP_MS = 20_000;
const POLL_TIMES = 9;

function maskPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 9) return raw?.trim() || '연락처 없음';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function smsKindLabel(kind: 'SMS' | 'LMS'): string {
  return kind === 'SMS' ? '짧은 문자 1건' : '긴 문자 1건';
}

function smsCostLabel(priceKrw: number, freeUnits: number): string {
  return `${priceKrw.toLocaleString('ko-KR')}원 (무료 건수면 ${freeUnits}건 차감)`;
}

const BTN_PRIMARY =
  'flex-1 rounded-lg bg-violet-700 px-3 py-2 text-fluid-xs font-semibold text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const BTN_QUIET =
  'flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

/**
 * 발주서 안내 보내기(알림톡·문자) — 결과를 가운데 팝업으로 알리고, 알림톡이 안 되면 문자로 보낼지 묻는다.
 * 발급 화면과 발주서 목록이 같이 쓴다.
 */
export function useOrderLinkSend(token: string | null | undefined) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [alimtalkBusyId, setAlimtalkBusyId] = useState<string | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);
  const [quote, setQuote] = useState<OrderLinkSmsQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [statusById, setStatusById] = useState<Record<string, OrderLinkSendInfo>>({});
  const pollRef = useRef<{ id: string; timer: number } | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) window.clearTimeout(pollRef.current.timer);
    pollRef.current = null;
  }, []);
  useEffect(() => stopPoll, [stopPoll]);

  const setStatus = useCallback((orderId: string, info: OrderLinkSendInfo) => {
    setStatusById((prev) => ({ ...prev, [orderId]: info }));
  }, []);

  const startPoll = useCallback(
    (orderId: string) => {
      if (!token) return;
      stopPoll();
      let left = POLL_TIMES;
      const tick = async () => {
        left -= 1;
        const info = await getOrderLinkSendStatus(token, orderId).catch(() => null);
        if (info) setStatus(orderId, info);
        if (left <= 0 || (info && info.status !== 'awaiting')) {
          pollRef.current = null;
          return;
        }
        pollRef.current = { id: orderId, timer: window.setTimeout(() => void tick(), POLL_GAP_MS) };
      };
      pollRef.current = { id: orderId, timer: window.setTimeout(() => void tick(), POLL_GAP_MS) };
    },
    [setStatus, stopPoll, token],
  );

  const loadQuote = useCallback(
    async (orderId: string) => {
      if (!token) return;
      setQuote(null);
      setQuoteState('loading');
      try {
        setQuote(await getOrderLinkSmsQuote(token, orderId));
        setQuoteState('idle');
      } catch {
        setQuoteState('failed');
      }
    },
    [token],
  );

  const sendAlimtalk = useCallback(
    async (order: OrderLinkSendTarget) => {
      if (!token || alimtalkBusyId) return;
      setAlimtalkBusyId(order.id);
      try {
        const result = await sendOrderFormOrderLinkAlimtalk(token, order.id, { toPhone: order.customerPhone });
        setStatus(order.id, { status: 'awaiting', channel: 'ATA', at: new Date().toISOString() });
        startPoll(order.id);
        setDialog({
          kind: 'alimtalk-ok',
          order,
          chargeLabel:
            result.chargeStatus === 'AWAITING_RESULT'
              ? '도착이 확인되면 차감'
              : alimtalkChargeStatusLabel(result.chargeStatus),
        });
      } catch (e) {
        const reason = e instanceof Error ? e.message : '알림톡 발송에 실패했습니다.';
        const smsAvailable = e instanceof OrderLinkAlimtalkError ? e.smsAvailable : true;
        setStatus(order.id, { status: 'failed', channel: null, at: new Date().toISOString(), message: reason });
        setDialog({ kind: 'alimtalk-fail', order, reason, smsAvailable });
        if (smsAvailable) void loadQuote(order.id);
      } finally {
        setAlimtalkBusyId(null);
      }
    },
    [alimtalkBusyId, loadQuote, setStatus, startPoll, token],
  );

  const askSms = useCallback(
    (order: OrderLinkSendTarget) => {
      if (!token) return;
      setDialog({ kind: 'sms-confirm', order });
      void loadQuote(order.id);
    },
    [loadQuote, token],
  );

  const sendSms = useCallback(
    async (order: OrderLinkSendTarget) => {
      if (!token || smsBusy) return;
      setSmsBusy(true);
      try {
        const result = await sendOrderFormOrderLinkSms(token, order.id, { toPhone: order.customerPhone });
        stopPoll();
        setStatus(order.id, { status: 'sms_sent', channel: result.kind, at: new Date().toISOString() });
        const chargeText =
          typeof result.chargedKrw === 'number' && result.chargedKrw > 0
            ? `${result.chargedKrw.toLocaleString('ko-KR')}원`
            : result.chargeStatus === 'FREE'
              ? `무료 건수 ${quote?.freeUnits ?? ALIMTALK_LMS_FREE_UNITS}건`
              : alimtalkChargeStatusLabel(result.chargeStatus);
        setDialog({ kind: 'sms-ok', order, smsKind: result.kind, chargeText });
      } catch (e) {
        setDialog({
          kind: 'sms-fail',
          order,
          reason: e instanceof Error ? e.message : '문자 발송에 실패했습니다.',
        });
      } finally {
        setSmsBusy(false);
      }
    },
    [quote, setStatus, smsBusy, stopPoll, token],
  );

  const close = useCallback(() => {
    if (smsBusy) return;
    setDialog(null);
  }, [smsBusy]);

  const price = quote?.priceKrw ?? ALIMTALK_UNIT_PRICE_LMS_KRW;
  const freeUnits = quote?.freeUnits ?? ALIMTALK_LMS_FREE_UNITS;
  const kindLabel = smsKindLabel(quote?.kind ?? 'LMS');
  const who = (order: OrderLinkSendTarget) =>
    `${order.customerName.trim() ? `${order.customerName.trim()}님 ` : ''}(${maskPhone(quote?.toPhone ?? order.customerPhone)})`;

  let node: ReactNode = null;
  if (dialog?.kind === 'alimtalk-ok') {
    node = (
      <Shell tone="ok" icon="✓" title="알림톡을 보냈어요" onClose={close}>
        <p className="mt-1.5 text-fluid-xs leading-relaxed text-slate-600">
          {who(dialog.order)}
          <br />
          도착 여부는 잠시 뒤 아래 상태 줄에 표시됩니다.
        </p>
        <InfoBox
          rows={[
            ['보낸 방식', '카카오 알림톡'],
            ['차감', dialog.chargeLabel],
          ]}
        />
        <div className="mt-3 flex gap-2">
          <button type="button" className={BTN_PRIMARY} onClick={close} autoFocus>
            확인
          </button>
        </div>
      </Shell>
    );
  } else if (dialog?.kind === 'alimtalk-fail') {
    const order = dialog.order;
    node = (
      <Shell tone="bad" icon="!" title="알림톡을 보내지 못했어요" onClose={close}>
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-fluid-2xs leading-relaxed text-rose-800">
          이유: {dialog.reason}
        </p>
        {dialog.smsAvailable ? (
          <>
            <p className="mt-3 text-fluid-xs font-bold text-slate-900">문자로 보내시겠습니까?</p>
            <InfoBox
              rows={[
                ['받는 번호', maskPhone(quote?.toPhone ?? order.customerPhone)],
                ['문자 종류', kindLabel],
                ['비용', smsCostLabel(price, freeUnits)],
              ]}
            />
            <div className="mt-3 flex gap-2">
              <button type="button" className={BTN_QUIET} onClick={close} disabled={smsBusy}>
                닫기
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={() => void sendSms(order)} disabled={smsBusy}>
                {smsBusy ? '보내는 중…' : '문자로 보내기'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={close} autoFocus>
              확인
            </button>
          </div>
        )}
      </Shell>
    );
  } else if (dialog?.kind === 'sms-confirm') {
    const order = dialog.order;
    node = (
      <Shell tone="sms" icon="✉" title="문자로 보낼까요?" onClose={close}>
        <p className="mt-1.5 text-fluid-xs text-slate-600">{who(order)}</p>
        <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-fluid-2xs leading-relaxed text-slate-700">
          {quoteState === 'loading' ? (
            '문자 내용을 불러오는 중…'
          ) : quote ? (
            <>
              {quote.subject?.trim() ? <p className="font-bold text-slate-900">{quote.subject.trim()}</p> : null}
              <p className="whitespace-pre-wrap break-words">{quote.body}</p>
            </>
          ) : (
            '문자 내용을 미리 보여 드리지 못했습니다. 등록된 발주서 안내 문구로 보냅니다.'
          )}
        </div>
        <InfoBox
          rows={[
            ['문자 종류', kindLabel],
            ['비용', smsCostLabel(price, freeUnits)],
          ]}
        />
        <div className="mt-3 flex gap-2">
          <button type="button" className={BTN_QUIET} onClick={close} disabled={smsBusy}>
            취소
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => void sendSms(order)}
            disabled={smsBusy || quoteState === 'loading'}
          >
            {smsBusy ? '보내는 중…' : '문자 보내기'}
          </button>
        </div>
      </Shell>
    );
  } else if (dialog?.kind === 'sms-ok') {
    node = (
      <Shell tone="ok" icon="✓" title="문자를 보냈어요" onClose={close}>
        <p className="mt-1.5 text-fluid-xs text-slate-600">{who(dialog.order)}</p>
        <InfoBox
          rows={[
            ['보낸 방식', dialog.smsKind === 'SMS' ? '짧은 문자' : '긴 문자'],
            ['차감', dialog.chargeText],
          ]}
        />
        <div className="mt-3 flex gap-2">
          <button type="button" className={BTN_PRIMARY} onClick={close} autoFocus>
            확인
          </button>
        </div>
      </Shell>
    );
  } else if (dialog?.kind === 'sms-fail') {
    const order = dialog.order;
    node = (
      <Shell tone="bad" icon="!" title="문자를 보내지 못했어요" onClose={close}>
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-fluid-2xs leading-relaxed text-rose-800">
          이유: {dialog.reason}
        </p>
        <p className="mt-3 text-fluid-2xs leading-relaxed text-slate-600">
          「메시지 복사」로 안내 문구를 복사해 직접 보내실 수 있습니다.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" className={BTN_QUIET} onClick={close}>
            닫기
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => askSms(order)}>
            다시 시도
          </button>
        </div>
      </Shell>
    );
  }

  return {
    /** 알림톡 보내기 → 결과 팝업 */
    sendAlimtalk,
    /** 문자로 보내기 → 내용·비용 확인 팝업 */
    askSms,
    /** 지금 알림톡을 보내는 중인 발주서 id */
    alimtalkBusyId,
    smsBusy,
    /** 이 화면에서 방금 보낸 결과. 없으면 undefined */
    statusFor: (orderId: string | null | undefined) => (orderId ? statusById[orderId] : undefined),
    dialogs: node,
  };
}
