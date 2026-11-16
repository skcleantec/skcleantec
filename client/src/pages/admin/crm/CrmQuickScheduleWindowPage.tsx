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

  function showMissing() {
    setCenterText(MISSING_CRM);
    setCenterAction(true);
  }

  async function askCrm(row: CrmQuickScheduleItem) {
    const requestId = crypto.randomUUID();
    postCrmQuickSchedule({ type: 'apply', requestId, item: row });
    const reply = await waitCrmQuickScheduleReply(requestId, 1500);
    return { requestId, reply };
  }

  async function handleLoad(row: CrmQuickScheduleItem) {
    const { reply } = await askCrm(row);
    if (!reply) showMissing();
  }

  async function handleCall(row: CrmQuickScheduleItem) {
    const token = getToken();
    if (!token) return;
    const dial = resolveCrmOutboundPhone(row.customerPhone, row.followup?.customerPhone2 ?? '');
    if (dial.replace(/\D/g, '').length < 8) {
      throw new Error('통화할 연락처가 없습니다.');
    }
    const { requestId, reply } = await askCrm(row);
    if (!reply) {
      showMissing();
      return;
    }
    if (reply.type === 'confirm') {
      void waitCrmQuickScheduleReply(requestId, 120_000).then((applied) => {
        if (applied?.type === 'applied') void placeCall(token, dial, row);
      });
      return;
    }
    await placeCall(token, dial, row);
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
