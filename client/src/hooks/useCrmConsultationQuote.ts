import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../stores/auth';
import {
  fetchTelecrmConsultationQuotes,
  finalizeTelecrmConsultationQuote,
  supersedeTelecrmConsultationQuotes,
  upsertTelecrmConsultationQuoteDraft,
  type FinalizeTelecrmConsultationQuoteBody,
  type TelecrmConsultationQuoteDto,
} from '../api/telecrmConsultationQuote';
import { crmQuotePayloadFromState, type CrmPricingQuoteLine } from '../utils/crmConsultationQuoteMap';
import { telecrmQuotePayloadHasContent } from '@shared/telecrmConsultationQuote';

export function useCrmConsultationQuote({
  phone,
  pyeong,
  pricePerPyeong,
  minimumTotalAmount,
  quoteLines,
  baseEstimateOverrideWon,
  hasLocalContent,
  operatingCompanyId,
  enabled = true,
}: {
  phone: string;
  pyeong: string;
  pricePerPyeong: number;
  minimumTotalAmount: number;
  quoteLines: CrmPricingQuoteLine[];
  baseEstimateOverrideWon?: number | null;
  hasLocalContent: boolean;
  operatingCompanyId?: string | null;
  enabled?: boolean;
}) {
  const [pendingQuote, setPendingQuote] = useState<TelecrmConsultationQuoteDto | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const skipSaveRef = useRef(false);

  const digits = phone.replace(/\D/g, '');

  const buildPayload = useCallback(
    () =>
      crmQuotePayloadFromState({
        pyeong,
        pricePerPyeong,
        minimumTotalAmount,
        quoteLines,
        baseEstimateOverrideWon,
      }),
    [minimumTotalAmount, pricePerPyeong, pyeong, quoteLines, baseEstimateOverrideWon],
  );

  const loadForPhone = useCallback(
    async (phoneDigits: string) => {
      const token = getToken();
      if (!token || !operatingCompanyId || phoneDigits.length < 4) {
        setPendingQuote(null);
        return;
      }
      try {
        const res = await fetchTelecrmConsultationQuotes(token, phoneDigits, operatingCompanyId);
        const candidate = res.draft ?? res.latestQuoted;
        setPendingQuote(candidate && !hasLocalContent ? candidate : null);
      } catch {
        setPendingQuote(null);
      }
    },
    [hasLocalContent, operatingCompanyId],
  );

  useEffect(() => {
    if (!enabled || !operatingCompanyId || digits.length < 4) {
      setPendingQuote(null);
      return;
    }
    if (hasLocalContent) {
      setPendingQuote(null);
      return;
    }
    void loadForPhone(digits);
  }, [digits, enabled, hasLocalContent, loadForPhone, operatingCompanyId]);

  useEffect(() => {
    if (!enabled || !operatingCompanyId || digits.length < 4) return;
    const payload = buildPayload();
    if (!telecrmQuotePayloadHasContent(payload)) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    const token = getToken();
    if (!token) return;

    const t = window.setTimeout(() => {
      setSaving(true);
      setSaveError(null);
      void upsertTelecrmConsultationQuoteDraft(token, { phone: digits, payload }, operatingCompanyId)
        .catch((e) => setSaveError(e instanceof Error ? e.message : '견적 저장 실패'))
        .finally(() => setSaving(false));
    }, 2000);

    return () => window.clearTimeout(t);
  }, [buildPayload, digits, enabled, operatingCompanyId]);

  const dismissPendingQuote = useCallback(() => {
    setPendingQuote(null);
  }, []);

  const startFreshQuote = useCallback(async () => {
    const token = getToken();
    if (!token || !operatingCompanyId || digits.length < 4) return;
    skipSaveRef.current = true;
    await supersedeTelecrmConsultationQuotes(token, digits, operatingCompanyId);
    setPendingQuote(null);
  }, [digits, operatingCompanyId]);

  const finalizeQuoteHold = useCallback(
    async (
      input: Omit<FinalizeTelecrmConsultationQuoteBody, 'phone' | 'payload'>,
    ): Promise<{ followupId: string; followupCreated: boolean }> => {
      const token = getToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      if (!operatingCompanyId) throw new Error('작업 브랜드가 선택되지 않았습니다.');
      if (digits.length < 4) throw new Error('연락처(4자 이상)가 필요합니다.');
      const payload = buildPayload();
      if (!telecrmQuotePayloadHasContent(payload)) {
        throw new Error('저장할 견적 내용이 없습니다.');
      }
      skipSaveRef.current = true;
      setFinalizing(true);
      setFinalizeError(null);
      try {
        const result = await finalizeTelecrmConsultationQuote(
          token,
          {
            phone: digits,
            payload,
            ...input,
          },
          operatingCompanyId,
        );
        setPendingQuote(null);
        return { followupId: result.followupId, followupCreated: result.followupCreated };
      } catch (e) {
        const message = e instanceof Error ? e.message : '견적 저장 · 보류 실패';
        setFinalizeError(message);
        throw e;
      } finally {
        setFinalizing(false);
      }
    },
    [buildPayload, digits, operatingCompanyId],
  );

  return {
    pendingQuote,
    dismissPendingQuote,
    startFreshQuote,
    saveError,
    saving,
    finalizing,
    finalizeError,
    finalizeQuoteHold,
    reloadQuotes: () => void loadForPhone(digits),
  };
}
