import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CrmQuickScheduleItem } from '../../../api/crmQuickSchedule';
import { getMe } from '../../../api/auth';
import { CrmQuickScheduleBody, type CrmQuickScheduleTab } from '../../../components/crm/quick-schedule/CrmQuickScheduleBody';
import { CrmQuickScheduleCenterNotice } from '../../../components/crm/quick-schedule/CrmQuickScheduleCenterNotice';
import { getToken } from '../../../stores/auth';
import { resolveCrmOutboundPhone } from '../../../utils/crmContactPhone';
import {
  postCrmQuickSchedule,
  subscribeCrmQuickSchedule,
  waitCrmQuickScheduleReply,
} from '../../../utils/crmQuickScheduleChannel';
import { rememberCrmQuickWindowRect } from '../../../utils/openCrmQuickScheduleWindow';
import { runTelecrmCallWithSoomgoAuto } from '../../../utils/soomgoCallAutoSend';

const MISSING_CRM = '텔레CRM 창이 열려 있지 않아요.';

export function CrmQuickScheduleWindowPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const operatingCompanyId = searchParams.get('operatingCompanyId')?.trim() || null;
  const [tab, setTab] = useState<CrmQuickScheduleTab>('all');
  const [marketerName, setMarketerName] = useState<string | null>(null);
  const [centerText, setCenterText] = useState<string | null>(null);
  const [centerAction, setCenterAction] = useState(false);
  const [replaceRow, setReplaceRow] = useState<CrmQuickScheduleItem | null>(null);

  useEffect(() => {
    document.title = '빠른일정 · 청소비서';
  }, []);

  useEffect(() => {
    const save = () => rememberCrmQuickWindowRect();
    const timer = window.setInterval(save, 2000);
    window.addEventListener('beforeunload', save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', save);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void getMe(token)
      .then((me) => setMarketerName(me.name?.trim() || null))
      .catch(() => setMarketerName(null));
  }, []);

  useEffect(() => {
    return subscribeCrmQuickSchedule((message) => {
      if (message.type !== 'brand' || !message.operatingCompanyId) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('operatingCompanyId', message.operatingCompanyId);
          return next;
        },
        { replace: true },
      );
    });
  }, [setSearchParams]);

  function showCenter(text: string, openCrm = false) {
    setReplaceRow(null);
    setCenterText(text);
    setCenterAction(openCrm);
  }

  async function sendApply(row: CrmQuickScheduleItem, force: boolean) {
    const requestId = crypto.randomUUID();
    postCrmQuickSchedule({ type: 'apply', requestId, item: row, force });
    const received = await waitCrmQuickScheduleReply(requestId, ['received'], 800);
    if (!received) {
      showCenter(MISSING_CRM, true);
      return;
    }
    const reply = await waitCrmQuickScheduleReply(requestId, ['applied', 'confirm', 'failed'], 15000);
    if (!reply) {
      showCenter('텔레CRM에서 불러오기가 끝나지 않았어요. 텔레CRM 창을 확인해 주세요.');
      return;
    }
    if (reply.type === 'confirm') {
      setCenterText(null);
      setCenterAction(false);
      setReplaceRow(row);
      return;
    }
    if (reply.type === 'failed') {
      showCenter(reply.message);
      return;
    }
    setReplaceRow(null);
    setCenterText(null);
  }

  async function handleLoad(row: CrmQuickScheduleItem) {
    await sendApply(row, false);
  }

  async function handleReplace() {
    const row = replaceRow;
    if (!row) return;
    setReplaceRow(null);
    await sendApply(row, true);
  }

  async function handleCall(row: CrmQuickScheduleItem) {
    const token = getToken();
    if (!token) {
      showCenter('로그인이 필요해요.');
      return;
    }
    const dial = resolveCrmOutboundPhone(row.customerPhone, row.followup?.customerPhone2 ?? '');
    if (dial.replace(/\D/g, '').length < 8) {
      showCenter('통화할 연락처가 없습니다.');
      return;
    }
    try {
      await placeCall(token, dial, row);
    } catch (e) {
      showCenter(e instanceof Error ? e.message : '전화를 걸지 못했습니다.');
    }
  }

  async function placeCall(token: string, dial: string, row: CrmQuickScheduleItem) {
    const { autoNotice, callNotice } = await runTelecrmCallWithSoomgoAuto({
      token,
      dialPhone: dial,
      telecrmCallOpts: row.inquiryId ? { customerMatch: 'existing', inquiryId: row.inquiryId } : { customerMatch: 'new' },
      soomgoCtx: {
        operatingCompanyId,
        customerName: row.customerName,
        nickname: row.nickname ?? '',
        marketerName: marketerName ?? undefined,
      },
    });
    const notice = autoNotice ?? callNotice;
    if (notice) {
      setCenterAction(false);
      setCenterText(notice);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-none px-4 py-4">
        {operatingCompanyId ? (
          <CrmQuickScheduleBody
            variant="window"
            enabled
            operatingCompanyId={operatingCompanyId}
            tab={tab}
            onTabChange={setTab}
            onLoad={handleLoad}
            onCall={handleCall}
          />
        ) : (
          <p className="py-16 text-center text-[13px] text-slate-500">작업 브랜드를 고른 뒤 다시 열어 주세요.</p>
        )}
      </div>
      {replaceRow ? (
        <CrmQuickScheduleCenterNotice
          text="텔레CRM에 작성 중인 내용이 있어요. 이 고객으로 바꿀까요?"
          actionLabel="바꿔서 불러오기"
          onAction={() => void handleReplace()}
          secondaryLabel="취소"
          onSecondary={() => setReplaceRow(null)}
        />
      ) : null}
      {centerText ? (
        <CrmQuickScheduleCenterNotice
          text={centerText}
          actionLabel={centerAction ? '텔레CRM 열기' : undefined}
          onAction={
            centerAction
              ? () => {
                  window.open('/admin/crm', '_blank', 'noopener');
                  setCenterText(null);
                }
              : undefined
          }
          onClose={() => setCenterText(null)}
        />
      ) : null}
    </div>
  );
}
