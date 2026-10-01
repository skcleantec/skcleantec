import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProfessionalOptionSelection } from '../constants/professionalSpecialtyOptions';
import type { OrderFormPublicTemplateField } from '../api/orderform';
import {
  isOrderFormCustomerStepId,
  resolveOrderFormCustomerSteps,
  type OrderFormCustomerStep,
  type OrderFormCustomerStepId,
} from '../components/orderform/customer-wizard/orderFormCustomerSteps';
import {
  isDesignerPreviewOrderToken,
  ORDER_FORM_PREVIEW_STEP_MESSAGE,
} from '@shared/orderFormPreviewWalk';
import {
  mergeDraftIntoForm,
  readOrderFormCustomerDraft,
  useOrderFormCustomerDraftPersist,
} from './useOrderFormCustomerDraft';
import {
  isCustomerAddressLocked,
  isOrderFormPrefillLocked,
  isStdFieldOn,
} from '../pages/order/orderFormFieldVisibility';
import type { OrderFormFields, OrderFormLoadedOrder } from '../pages/order/orderFormModel.types';

export function useOrderFormModel(args: {
  token: string;
  enabled: boolean;
  loaded: boolean;
  form: OrderFormFields;
  setForm: Dispatch<SetStateAction<OrderFormFields>>;
  customAnswers: Record<string, unknown>;
  setCustomAnswers: Dispatch<SetStateAction<Record<string, unknown>>>;
  profSelections: ProfessionalOptionSelection[];
  setProfSelections: Dispatch<SetStateAction<ProfessionalOptionSelection[]>>;
  order: OrderFormLoadedOrder | null;
  customFields: OrderFormPublicTemplateField[];
  isEditor: boolean;
  guideTermsAt: string | null;
  setGuideTermsConsent: (v: { at: string; signaturePng: string; typedName: string } | null) => void;
}) {
  const {
    token,
    enabled,
    loaded,
    form,
    setForm,
    customAnswers,
    setCustomAnswers,
    profSelections,
    setProfSelections,
    order,
    customFields,
    isEditor,
    guideTermsAt,
  } = args;

  const stdFieldOn = useCallback((key: string) => isStdFieldOn(order, key), [order]);
  const lockKey = useCallback(
    (key: string) => isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, key),
    [isEditor, order?.prefillAnswers],
  );
  const addressFieldLocked = isCustomerAddressLocked(isEditor, order?.prefillAnswers);

  const steps = useMemo(
    () =>
      resolveOrderFormCustomerSteps({
        order,
        form,
        customFields,
        isEditor,
        skipLocked: false,
      }),
    [order, form, customFields, isEditor],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const stepFromUrl = searchParams.get('step');
  const persistDraft = enabled && loaded && !isDesignerPreviewOrderToken(token);

  const stepIndex = useMemo(() => {
    if (isOrderFormCustomerStepId(stepFromUrl)) {
      const idx = steps.findIndex((s) => s.id === stepFromUrl);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [stepFromUrl, steps]);

  const currentStep: OrderFormCustomerStep | undefined = steps[stepIndex];

  const setStepId = useCallback(
    (id: OrderFormCustomerStepId, replace = false) => {
      const next = new URLSearchParams(searchParams);
      next.set('step', id);
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  const previewWalk = isDesignerPreviewOrderToken(token);

  useEffect(() => {
    if (!enabled || !loaded) return;
    if (isOrderFormCustomerStepId(stepFromUrl) && steps.some((s) => s.id === stepFromUrl)) return;
    // 미리보기는 설정이 고른 페이지(step)를 손님 단계가 늦게 잡혀도 첫 페이지로 덮지 않는다.
    if (previewWalk && isOrderFormCustomerStepId(stepFromUrl)) return;
    const first = steps[0]?.id;
    if (first) setStepId(first, true);
  }, [enabled, loaded, stepFromUrl, steps, setStepId, previewWalk]);

  useEffect(() => {
    if (!previewWalk || !currentStep) return;
    if (
      isOrderFormCustomerStepId(stepFromUrl) &&
      stepFromUrl !== currentStep.id &&
      !steps.some((s) => s.id === stepFromUrl)
    ) {
      return;
    }
    window.parent.postMessage(
      { type: ORDER_FORM_PREVIEW_STEP_MESSAGE, step: currentStep.id },
      window.location.origin,
    );
  }, [previewWalk, currentStep, stepFromUrl, steps]);

  useEffect(() => {
    if (!previewWalk) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; step?: string } | null;
      if (!data || data.type !== ORDER_FORM_PREVIEW_STEP_MESSAGE) return;
      const step = data.step ?? '';
      if (!isOrderFormCustomerStepId(step) || step === stepFromUrl) return;
      if (!steps.some((s) => s.id === step)) return;
      setStepId(step, true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [previewWalk, stepFromUrl, steps, setStepId]);

  useEffect(() => {
    if (!persistDraft || !token) return;
    const draft = readOrderFormCustomerDraft(token);
    if (!draft) return;
    setForm((f) => mergeDraftIntoForm(f, draft.form));
    setCustomAnswers((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(draft.customAnswers ?? {})) {
        if (next[k] == null || next[k] === '') next[k] = v;
      }
      return next;
    });
    setProfSelections((prev) => (prev.length > 0 ? prev : draft.profSelections ?? []));
    // 서명은 임시저장하지 않음 — 다시 열고 서명해야 함
    // 초안은 로드 직후 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistDraft, token]);

  useOrderFormCustomerDraftPersist({
    token,
    enabled: persistDraft,
    form,
    customAnswers,
    profSelections,
    guideTermsAt,
  });

  const goNext = useCallback(() => {
    const next = steps[stepIndex + 1];
    if (next) setStepId(next.id);
  }, [steps, stepIndex, setStepId]);

  const goPrev = useCallback(() => {
    const prev = steps[stepIndex - 1];
    if (prev) setStepId(prev.id);
    else setStepId(steps[0]?.id ?? 'welcome');
  }, [steps, stepIndex, setStepId]);

  const goTo = useCallback(
    (id: OrderFormCustomerStepId) => {
      if (steps.some((s) => s.id === id)) setStepId(id);
    },
    [steps, setStepId],
  );

  const progressCount = steps.filter((s) => s.kind !== 'welcome').length;
  const progressDone = Math.max(0, stepIndex - (steps[0]?.kind === 'welcome' ? 1 : 0));
  const progressRatio = progressCount <= 0 ? 0 : Math.min(1, progressDone / progressCount);

  return {
    stdFieldOn,
    lockKey,
    addressFieldLocked,
    steps,
    currentStep,
    stepIndex,
    goNext,
    goPrev,
    goTo,
    progressRatio,
    progressLabel: `${Math.min(progressDone + 1, progressCount)} / ${progressCount}`,
  };
}
