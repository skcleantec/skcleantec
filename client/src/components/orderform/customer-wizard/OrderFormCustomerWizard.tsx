import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { TenantBrandLogo } from '../../brand/TenantBrandLogo';
import { OrderFormCompanyTrustFooter } from '../OrderFormCompanyTrustFooter';
import { OrderFormPlatformFooter } from '../OrderFormPlatformFooter';
import { useLoginScrollSurface } from '../../../hooks/useMobileInputVisibility';
import { validateCustomerStep } from './validateCustomerStep';
import { WIZARD_CTA_CLS, WIZARD_SECONDARY_CLS } from './wizardUi';
import type { CustomerWizardShared } from './customerStepTypes';
import type { OrderFormCustomerStep } from './orderFormCustomerSteps';
import { WelcomeStep, NameStep, PhonesStep, EmailStep, NotesStep } from './steps/WelcomeAndInputSteps';
import {
  PropertyStep,
  BuildingStep,
  TimeStep,
  TimeDetailStep,
  DateStep,
  AreaStep,
  RoomsStep,
} from './steps/ChoiceAndAreaSteps';
import {
  AddressStep,
  MoveInStep,
  CustomFieldStep,
  PhotosStep,
  ProfessionalStep,
  ReviewStep,
  GuideStep,
} from './steps/CompoundSteps';
import type { PublicOperatingCompanyBranding, PublicOrderFormCompanyTrust } from '../../../api/orderform';

function StepBody(props: CustomerWizardShared & { step: OrderFormCustomerStep }) {
  switch (props.step.id) {
    case 'welcome':
      return null;
    case 'name':
      return <NameStep {...props} />;
    case 'address':
      return <AddressStep {...props} />;
    case 'phones':
      return <PhonesStep {...props} />;
    case 'email':
      return <EmailStep {...props} />;
    case 'property':
      return <PropertyStep {...props} />;
    case 'area':
      return <AreaStep {...props} />;
    case 'date':
      return <DateStep {...props} />;
    case 'time':
      return <TimeStep {...props} />;
    case 'timeDetail':
      return <TimeDetailStep {...props} />;
    case 'rooms':
      return <RoomsStep {...props} />;
    case 'building':
      return <BuildingStep {...props} />;
    case 'moveIn':
      return <MoveInStep {...props} />;
    case 'notes':
      return <NotesStep {...props} />;
    case 'photos':
      return <PhotosStep {...props} />;
    case 'professional':
      return <ProfessionalStep {...props} />;
    case 'review':
      return <ReviewStep {...props} />;
    case 'guide':
      return <GuideStep {...props} />;
    default:
      if (String(props.step.id).startsWith('custom:')) return <CustomFieldStep {...props} />;
      return null;
  }
}

export function OrderFormCustomerWizard({
  headingTitle,
  brandName,
  publicBranding,
  publicCompanyTrust,
  leaveHint,
  onLeave,
  progressRatio,
  progressLabel,
  currentStep,
  stepIndex,
  goNext,
  goPrev,
  canGoBack,
  timeSlotAckOpen,
  timeSlotConsentAt,
  shared,
  onSubmit,
  submitting,
  dialogs,
}: {
  headingTitle: string;
  brandName?: string | null;
  publicBranding: PublicOperatingCompanyBranding | null;
  publicCompanyTrust: PublicOrderFormCompanyTrust | null;
  leaveHint: string | null;
  onLeave: () => void;
  progressRatio: number;
  progressLabel: string;
  currentStep: OrderFormCustomerStep;
  stepIndex: number;
  goNext: () => void;
  goPrev: () => void;
  canGoBack: boolean;
  timeSlotAckOpen: boolean;
  timeSlotConsentAt: string | null;
  shared: CustomerWizardShared;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  dialogs: ReactNode;
}) {
  const { scrollRef, onFieldFocus } = useLoginScrollSurface({ bottomReservePx: 80 });
  const [stepError, setStepError] = useState<string | null>(null);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const prevIndexRef = useRef(stepIndex);
  const lastConsentAtRef = useRef(timeSlotConsentAt);

  useEffect(() => {
    setDir(stepIndex >= prevIndexRef.current ? 'forward' : 'back');
    prevIndexRef.current = stepIndex;
    setStepError(null);
  }, [stepIndex]);

  useEffect(() => {
    if (currentStep.id !== 'time' || timeSlotAckOpen) return;
    if (timeSlotConsentAt && timeSlotConsentAt !== lastConsentAtRef.current) {
      lastConsentAtRef.current = timeSlotConsentAt;
      goNext();
    }
  }, [currentStep.id, timeSlotAckOpen, timeSlotConsentAt, goNext]);

  const stepInvalid = validateCustomerStep({
    step: currentStep,
    form: shared.form,
    customAnswers: shared.customAnswers,
    order: shared.order,
    isEditor: false,
    addressConfirmedViaSearch: shared.addressConfirmedViaSearch,
    oneRoomLabel: shared.oneRoomLabel,
    guideTermsAt: shared.guideTermsAt,
  });

  const tryNext = () => {
    if (currentStep.skippable && stepInvalid) {
      goNext();
      return;
    }
    if (stepInvalid) {
      setStepError(stepInvalid);
      return;
    }
    setStepError(null);
    goNext();
  };

  const showFooter =
    currentStep.kind !== 'welcome' && currentStep.kind !== 'choice';
  const showChoiceNext = currentStep.kind === 'choice' && !stepInvalid;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={canGoBack ? goPrev : onLeave}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50"
            aria-label={canGoBack ? '이전 질문' : '닫기'}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <TenantBrandLogo height={26} />
            <p className="truncate text-fluid-2xs text-slate-300">{headingTitle}</p>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg px-2 py-1.5 text-fluid-2xs text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            닫기
          </button>
        </div>
        <div className="h-1 bg-slate-700" aria-hidden>
          <div
            className="h-full bg-white transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>
      </header>

      <div
        ref={scrollRef}
        className="login-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        onFocusCapture={onFieldFocus}
      >
        <div className="login-scroll-content mx-auto flex min-h-full max-w-lg flex-col px-4 py-6 pb-28">
          {leaveHint ? (
            <div
              className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900"
              role="status"
            >
              {leaveHint}
            </div>
          ) : null}
          {publicBranding?.publicSubtitle ? (
            <p className="mb-3 text-fluid-2xs text-slate-500">{publicBranding.publicSubtitle}</p>
          ) : null}
          <p className="mb-4 text-fluid-2xs font-medium tabular-nums text-slate-400">{progressLabel}</p>

          <div
            key={currentStep.id}
            className={dir === 'back' ? 'order-wizard-pane-back' : 'order-wizard-pane'}
          >
            {currentStep.kind === 'welcome' ? (
              <WelcomeStep
                title={currentStep.title}
                hint={currentStep.hint}
                brandName={brandName}
                onStart={goNext}
              />
            ) : (
              <StepBody {...shared} step={currentStep} goNext={goNext} goTo={shared.goTo} />
            )}
          </div>

          {stepError ? (
            <p className="mt-4 text-fluid-xs font-medium text-red-700" role="alert">
              {stepError}
            </p>
          ) : null}

          <div className="mt-auto pt-8">
            <OrderFormCompanyTrustFooter
              trust={publicCompanyTrust}
              displayNameFallback={publicBranding?.displayName}
            />
            <OrderFormPlatformFooter />
          </div>
        </div>
      </div>

      {showFooter || showChoiceNext ? (
        <footer className="sticky z-20 border-t border-slate-200 bg-white/95 backdrop-blur-sm bottom-[var(--login-keyboard-inset,0px)]">
          <div className="mx-auto flex max-w-lg gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            {currentStep.skippable && stepInvalid ? (
              <button type="button" className={WIZARD_SECONDARY_CLS} onClick={goNext}>
                건너뛰기
              </button>
            ) : null}
            {currentStep.kind === 'guide' ? (
              <button
                type="button"
                className={WIZARD_CTA_CLS}
                disabled={submitting || Boolean(stepInvalid)}
                onClick={() => onSubmit({ preventDefault() {} } as FormEvent)}
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            ) : currentStep.kind === 'review' ? (
              <button type="button" className={WIZARD_CTA_CLS} onClick={goNext}>
                안내 확인하고 제출
              </button>
            ) : (
              <button
                type="button"
                className={WIZARD_CTA_CLS}
                disabled={!currentStep.skippable && Boolean(stepInvalid)}
                onClick={tryNext}
              >
                다음
              </button>
            )}
          </div>
        </footer>
      ) : null}

      {dialogs}
    </div>
  );
}
