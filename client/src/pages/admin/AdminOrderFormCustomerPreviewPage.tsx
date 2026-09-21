import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getDesignerPreviewOrderToken,
  getFormConfig,
  updateFormConfig,
  type OrderFormConfigPublic,
} from '../../api/orderform';
import {
  createEstimateOption,
  deleteEstimateOption,
  getEstimateConfig,
  getEstimateOptions,
  updateEstimateConfig,
  updateEstimateOption,
  type EstimateOption,
} from '../../api/estimate';
import { listOrderFormTemplates, type OrderFormTemplate } from '../../api/orderFormTemplates';
import { OrderGuideFormScopeBar } from '../../components/admin/OrderGuideFormScopeBar';
import { OrderFormPreviewViewport } from '../../components/admin/OrderFormPreviewViewport';
import {
  OrderFormSettingsCommonBadge,
  OrderFormSettingsOpenAllButton,
  OrderFormSettingsSection,
  OrderFormSettingsThisFormBadge,
} from '../../components/admin/order-form-settings/OrderFormSettingsSection';
import {
  OrderFormSettingsCopyPanel,
  OrderFormSettingsPricePanel,
} from '../../components/admin/order-form-settings/OrderFormSettingsCopyPanels';
import {
  isSettingsSectionOpenByDefault,
  ORDER_FORM_SETTINGS_SECTIONS,
  parseSettingsSection,
  type OrderFormSettingsSectionId,
} from '../../components/admin/order-form-settings/orderFormSettingsSections';
import { OrderFormTemplateEditorPanel } from '../../components/admin/order-templates/OrderFormTemplateEditorPanel';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { useStaffAppEditPanelKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { getToken } from '../../stores/auth';
import { normalizeMsgConfigForEditor, type FormMessagesState } from '../../utils/orderFormCustomerCopy';
import { appendPublicQuery } from '../../utils/publicTenantQuery';
import {
  DEFAULT_ORDER_TIME_SLOT_LABELS,
  resolveOrderTimeSlotLabels,
  type OrderTimeSlotLabels,
} from '@shared/orderFormTimeSlotLabels';
import { withOrderFormPreviewWalkQuery } from '@shared/orderFormPreviewWalk';
import { AdminOrderFormLeadSourceSettingsPage } from './AdminOrderFormLeadSourceSettingsPage';
import { AdminOrderFormNoticePage } from './AdminOrderFormNoticePage';
import { AdminOrderFormSpecialtySettingsPage } from './AdminOrderFormSpecialtySettingsPage';

function initialOpenMap(focus: OrderFormSettingsSectionId | null): Record<OrderFormSettingsSectionId, boolean> {
  const next = {} as Record<OrderFormSettingsSectionId, boolean>;
  for (const id of ORDER_FORM_SETTINGS_SECTIONS) {
    next[id] = focus ? id === focus : isSettingsSectionOpenByDefault(id);
  }
  return next;
}

export function AdminOrderFormCustomerPreviewPage() {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusSection = parseSettingsSection(searchParams.get('section'), searchParams.get('panel'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [previewForms, setPreviewForms] = useState<OrderFormTemplate[]>([]);
  const [configForm, setConfigForm] = useState({ pricePerPyeong: '', minimumTotalAmount: '', depositAmount: '' });
  const [configSaving, setConfigSaving] = useState(false);
  const [options, setOptions] = useState<EstimateOption[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionAmount, setNewOptionAmount] = useState('');
  const [msgConfig, setMsgConfig] = useState<FormMessagesState>(() =>
    normalizeMsgConfigForEditor({} as unknown as OrderFormConfigPublic),
  );
  const [msgSavingKey, setMsgSavingKey] = useState<string | null>(null);
  const [timeSlotLabels, setTimeSlotLabels] = useState<OrderTimeSlotLabels>(() => ({
    ...DEFAULT_ORDER_TIME_SLOT_LABELS,
  }));
  const [openMap, setOpenMap] = useState<Record<OrderFormSettingsSectionId, boolean>>(() =>
    initialOpenMap(focusSection),
  );
  const editPanelScrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus: onEditPanelFieldFocus } = useStaffAppEditPanelKeyboardAvoidance(editPanelScrollRef);

  const previewFormParam = searchParams.get('previewForm')?.trim() || searchParams.get('id')?.trim() || '';
  const guideFormId = searchParams.get('guideForm')?.trim() || '';
  const previewFormId = previewFormParam || guideFormId;
  const resolvedPreviewFormId =
    previewFormId || previewForms.find((f) => f.isDefault)?.id || previewForms[0]?.id || '';
  const selectedTitle = previewForms.find((f) => f.id === resolvedPreviewFormId)?.title ?? '';

  const setPreviewForm = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      if (id) {
        next.set('previewForm', id);
        next.set('guideForm', id);
      } else {
        next.delete('previewForm');
        next.delete('guideForm');
      }
      next.delete('id');
      next.delete('panel');
      setSearchParams(next, { replace: true });
      if (token) {
        void getDesignerPreviewOrderToken(token, { templateId: id || null }).catch(() => {});
      }
      setIframeKey((k) => k + 1);
    },
    [searchParams, setSearchParams, token],
  );

  const setSectionOpen = useCallback(
    (id: OrderFormSettingsSectionId, open: boolean) => {
      setOpenMap((prev) => ({ ...prev, [id]: open }));
      const next = new URLSearchParams(searchParams);
      if (open) next.set('section', id);
      else if (next.get('section') === id) next.delete('section');
      next.delete('panel');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const allOpen = ORDER_FORM_SETTINGS_SECTIONS.every((id) => openMap[id]);
  const toggleAll = () => {
    const nextOpen = !allOpen;
    setOpenMap(() => {
      const next = {} as Record<OrderFormSettingsSectionId, boolean>;
      for (const id of ORDER_FORM_SETTINGS_SECTIONS) next[id] = nextOpen;
      return next;
    });
  };

  const refreshEstimate = useCallback(() => {
    if (!token) return;
    getEstimateConfig(token)
      .then((c) => {
        setConfigForm({
          pricePerPyeong: String(c.pricePerPyeong),
          minimumTotalAmount: String(c.minimumTotalAmount ?? 0),
          depositAmount: String(c.depositAmount),
        });
      })
      .catch(() => {});
  }, [token]);

  const refreshOptions = useCallback(() => {
    if (!token) return;
    getEstimateOptions(token)
      .then((r) => setOptions(r.items))
      .catch(() => {});
  }, [token]);

  const refreshMsg = useCallback(() => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => {
        setMsgConfig(normalizeMsgConfigForEditor(c));
        setTimeSlotLabels(resolveOrderTimeSlotLabels(c.timeSlotLabelsJson ?? null));
      })
      .catch(() => {});
  }, [token]);

  const bumpIframe = useCallback(async () => {
    if (!token) return;
    try {
      await getDesignerPreviewOrderToken(token, { templateId: resolvedPreviewFormId || null });
      setIframeKey((k) => k + 1);
    } catch {
      /* ignore */
    }
  }, [token, resolvedPreviewFormId]);

  const refreshForms = useCallback(async () => {
    if (!token) return;
    const templates = await listOrderFormTemplates(token);
    setPreviewForms(templates.filter((t) => t.status !== 'ARCHIVED'));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDesignerPreviewOrderToken(token, { templateId: previewFormId || null }),
      getFormConfig(token),
      getEstimateConfig(token),
      getEstimateOptions(token),
      listOrderFormTemplates(token),
    ])
      .then(([pv, fc, ec, eo, templates]) => {
        if (cancelled) return;
        setPreviewToken(pv.token);
        setPreviewForms(templates.filter((t) => t.status !== 'ARCHIVED'));
        setMsgConfig(normalizeMsgConfigForEditor(fc));
        setTimeSlotLabels(resolveOrderTimeSlotLabels(fc.timeSlotLabelsJson ?? null));
        setConfigForm({
          pricePerPyeong: String(ec.pricePerPyeong),
          minimumTotalAmount: String(ec.minimumTotalAmount ?? 0),
          depositAmount: String(ec.depositAmount),
        });
        setOptions(eo.items);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!resolvedPreviewFormId) return;
    setIframeKey((k) => k + 1);
  }, [resolvedPreviewFormId]);

  useEffect(() => {
    if (!focusSection) return;
    setOpenMap((prev) => ({ ...prev, [focusSection]: true }));
  }, [focusSection]);

  useEffect(() => {
    if (!resolvedPreviewFormId) return;
    if (searchParams.get('previewForm') === resolvedPreviewFormId && searchParams.get('guideForm') === resolvedPreviewFormId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('previewForm', resolvedPreviewFormId);
    next.set('guideForm', resolvedPreviewFormId);
    next.delete('id');
    setSearchParams(next, { replace: true });
  }, [resolvedPreviewFormId, searchParams, setSearchParams]);

  const iframeSrc = useMemo(() => {
    if (typeof window === 'undefined' || !previewToken) return '';
    return withOrderFormPreviewWalkQuery(
      appendPublicQuery(`${window.location.origin}/order/${encodeURIComponent(previewToken)}`, {
        tenantSlug: staffTenantSlug || null,
      }),
      { previewTemplateId: resolvedPreviewFormId || null },
    );
  }, [previewToken, staffTenantSlug, resolvedPreviewFormId]);

  const saveMsgPartial = async (key: string, payload: Partial<OrderFormConfigPublic>) => {
    if (!token) return;
    setMsgSavingKey(key);
    setError(null);
    try {
      await updateFormConfig(token, payload);
      refreshMsg();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '폼 메시지 저장에 실패했습니다.');
    } finally {
      setMsgSavingKey(null);
    }
  };

  const handleSaveMsg = async () => {
    if (!token) return;
    setMsgSavingKey('all');
    setError(null);
    try {
      await updateFormConfig(token, {
        formTitle: msgConfig.formTitle || undefined,
        priceLabel: msgConfig.priceLabel || undefined,
        reviewEventText: msgConfig.reviewEventText ?? '',
        footerNotice1: msgConfig.footerNotice1 || undefined,
        footerNotice2: msgConfig.footerNotice2 || undefined,
        submitSuccessTitle: msgConfig.submitSuccessTitle || undefined,
        submitSuccessBody: msgConfig.submitSuccessBody || undefined,
        timeSlotAckBody: msgConfig.timeSlotAckBody || undefined,
        serviceDateAckBody: msgConfig.serviceDateAckBody || undefined,
        timeSlotLabelsJson: {
          오전: timeSlotLabels.오전,
          오후: timeSlotLabels.오후,
          사이청소: timeSlotLabels.사이청소,
          조율: timeSlotLabels.조율,
        },
      });
      refreshMsg();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '폼 메시지 저장에 실패했습니다.');
    } finally {
      setMsgSavingKey(null);
    }
  };

  const handleSaveEstimate = async () => {
    if (!token) return;
    setConfigSaving(true);
    setError(null);
    try {
      const price = parseInt(configForm.pricePerPyeong, 10);
      const minimum = parseInt(configForm.minimumTotalAmount, 10);
      const deposit = parseInt(configForm.depositAmount, 10);
      if (Number.isNaN(price) || Number.isNaN(minimum) || Number.isNaN(deposit)) {
        throw new Error('평당 금액·최소 금액·예약금을 숫자로 입력해 주세요.');
      }
      await updateEstimateConfig(token, {
        pricePerPyeong: price,
        minimumTotalAmount: Math.max(0, minimum),
        depositAmount: deposit,
      });
      refreshEstimate();
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '견적 설정 저장에 실패했습니다.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddOption = async () => {
    if (!token || !newOptionName.trim()) return;
    try {
      await createEstimateOption(token, {
        name: newOptionName.trim(),
        extraAmount: newOptionAmount ? parseInt(newOptionAmount, 10) : 0,
      });
      setNewOptionName('');
      setNewOptionAmount('');
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '옵션 추가에 실패했습니다.');
    }
  };

  const handleToggleOption = async (opt: EstimateOption) => {
    if (!token) return;
    try {
      await updateEstimateOption(token, opt.id, { isActive: !opt.isActive });
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '옵션 수정에 실패했습니다.');
    }
  };

  const handleDeleteOption = async (opt: EstimateOption) => {
    if (!token) return;
    if (!confirm(`"${opt.name}" 옵션을 삭제할까요?`)) return;
    try {
      await deleteEstimateOption(token, opt.id);
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const onTemplateChanged = useCallback(
    (updated: OrderFormTemplate) => {
      setPreviewForms((prev) => {
        const i = prev.findIndex((t) => t.id === updated.id);
        if (i < 0) return [...prev, updated];
        return prev.map((t) => (t.id === updated.id ? updated : t));
      });
      if (updated.id !== resolvedPreviewFormId) setPreviewForm(updated.id);
      void bumpIframe();
    },
    [bumpIframe, resolvedPreviewFormId, setPreviewForm],
  );

  const onTemplateDeleted = useCallback(
    (id: string) => {
      setPreviewForms((prev) => prev.filter((t) => t.id !== id));
      if (resolvedPreviewFormId === id) setPreviewForm('');
      void refreshForms();
      void bumpIframe();
    },
    [bumpIframe, refreshForms, resolvedPreviewFormId, setPreviewForm],
  );

  const previewPane = (
    <OrderFormPreviewViewport className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-amber-50 px-3 py-1.5">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-fluid-2xs font-medium leading-snug text-amber-950">
            손님 화면 · {selectedTitle || '발주서'}
          </p>
          {previewForms.length > 0 ? (
            <OrderGuideFormScopeBar
              compact
              forms={previewForms.map((f) => ({ id: f.id, title: f.title, isDefault: f.isDefault }))}
              formId={resolvedPreviewFormId}
              onChange={setPreviewForm}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void bumpIframe()}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            새로고침
          </button>
          {previewToken ? (
            <a
              href={iframeSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fluid-2xs font-medium text-blue-700 underline hover:text-blue-800"
            >
              새 탭
            </a>
          ) : null}
        </div>
      </div>
      <div className="min-h-[28rem] flex-1 bg-white lg:min-h-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-fluid-sm text-gray-500">고객 화면 불러오는 중…</div>
        ) : iframeSrc ? (
          <iframe key={iframeKey} title="고객 발주서" src={iframeSrc} className="h-full min-h-[28rem] w-full border-0 bg-gray-50 lg:min-h-full" />
        ) : (
          <p className="p-4 text-fluid-sm text-gray-600">미리보기 주소를 불러오지 못했습니다.</p>
        )}
      </div>
    </OrderFormPreviewViewport>
  );

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3">
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <PageTitleWithFavorite label="발주서설정">
              <h2 className="text-fluid-base font-semibold text-gray-900">발주서설정</h2>
            </PageTitleWithFavorite>
            <p className="mt-1 text-fluid-xs text-gray-500">
              왼쪽에서 발주서를 고르면 오른쪽이 그 양식 설정입니다. 금액·전문시공은 모든 발주서가 같이 씁니다.
            </p>
          </div>
          <Link
            to="/admin/inquiries/order-templates?new=1"
            className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            + 새 발주서
          </Link>
        </div>
        {error ? <p className="mt-2 text-fluid-xs text-red-600">{error}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <details className="group rounded-lg border border-amber-200 bg-amber-50/40 lg:hidden">
          <summary className="cursor-pointer px-3 py-2 text-fluid-xs font-medium text-amber-950">
            손님 화면 미리보기 {selectedTitle ? `· ${selectedTitle}` : ''}
          </summary>
          <div className="border-t border-amber-200">{previewPane}</div>
        </details>
        <div className="hidden min-h-0 lg:flex lg:flex-col">{previewPane}</div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-slate-50">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-fluid-2xs text-slate-500">오른쪽 설정</p>
              <p className="truncate text-fluid-sm font-semibold text-slate-900" title={selectedTitle}>
                {selectedTitle || '발주서를 고르세요'}
              </p>
            </div>
            <OrderFormSettingsOpenAllButton allOpen={allOpen} onToggle={toggleAll} />
          </div>
          <div
            ref={editPanelScrollRef}
            className="modal-form-scroll-surface min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain p-2 sm:p-3"
            onFocusCapture={onEditPanelFieldFocus}
          >
            <OrderFormSettingsSection
              id="basics"
              title="이름·사용"
              hint="이 발주서 이름·아이콘·사용하기"
              open={openMap.basics}
              onOpenChange={(open) => setSectionOpen('basics', open)}
              badge={<OrderFormSettingsThisFormBadge />}
            >
              {token && resolvedPreviewFormId ? (
                <OrderFormTemplateEditorPanel
                  key={`${resolvedPreviewFormId}-basics`}
                  token={token}
                  templateId={resolvedPreviewFormId}
                  mode="basics"
                  onChanged={onTemplateChanged}
                  onDeleted={onTemplateDeleted}
                />
              ) : null}
            </OrderFormSettingsSection>

            <OrderFormSettingsSection
              id="fields"
              title="입력 칸"
              hint="시간대 하위 항목·손님 칸"
              open={openMap.fields}
              onOpenChange={(open) => setSectionOpen('fields', open)}
              badge={<OrderFormSettingsThisFormBadge />}
            >
              {token && resolvedPreviewFormId ? (
                <OrderFormTemplateEditorPanel
                  key={`${resolvedPreviewFormId}-fields`}
                  token={token}
                  templateId={resolvedPreviewFormId}
                  mode="fields"
                  onChanged={onTemplateChanged}
                  onDeleted={onTemplateDeleted}
                />
              ) : null}
            </OrderFormSettingsSection>

            <OrderFormSettingsSection
              id="guide"
              title="안내·동의"
              hint="이 발주서를 받은 손님이 끝까지 읽고 서명합니다"
              open={openMap.guide}
              onOpenChange={(open) => setSectionOpen('guide', open)}
              badge={<OrderFormSettingsThisFormBadge />}
            >
              <AdminOrderFormNoticePage embedded />
            </OrderFormSettingsSection>

            <OrderFormSettingsSection
              id="copy"
              title="손님 문구"
              hint="제목·리뷰·하단·제출완료·확인 모달"
              open={openMap.copy}
              onOpenChange={(open) => setSectionOpen('copy', open)}
              badge={<OrderFormSettingsCommonBadge />}
            >
              <OrderFormSettingsCopyPanel
                msgConfig={msgConfig}
                setMsgConfig={setMsgConfig}
                msgSavingKey={msgSavingKey}
                onSaveMsg={() => void handleSaveMsg()}
                saveMsgPartial={(key, payload) => void saveMsgPartial(key, payload)}
                timeSlotLabels={timeSlotLabels}
                setTimeSlotLabels={setTimeSlotLabels}
              />
            </OrderFormSettingsSection>

            <OrderFormSettingsSection
              id="price"
              title="금액·견적"
              hint="평당·예약금·추가 옵션"
              open={openMap.price}
              onOpenChange={(open) => setSectionOpen('price', open)}
              badge={<OrderFormSettingsCommonBadge />}
            >
              <OrderFormSettingsPricePanel
                configForm={configForm}
                setConfigForm={setConfigForm}
                configSaving={configSaving}
                onSaveEstimate={() => void handleSaveEstimate()}
                msgConfig={msgConfig}
                setMsgConfig={setMsgConfig}
                msgSavingKey={msgSavingKey}
                onSaveMsg={() => void handleSaveMsg()}
                options={options}
                newOptionName={newOptionName}
                setNewOptionName={setNewOptionName}
                newOptionAmount={newOptionAmount}
                setNewOptionAmount={setNewOptionAmount}
                onAddOption={() => void handleAddOption()}
                onToggleOption={(opt) => void handleToggleOption(opt)}
                onDeleteOption={(opt) => void handleDeleteOption(opt)}
              />
            </OrderFormSettingsSection>

            <OrderFormSettingsSection
              id="specialty"
              title="전문시공"
              open={openMap.specialty}
              onOpenChange={(open) => setSectionOpen('specialty', open)}
              badge={<OrderFormSettingsCommonBadge />}
            >
              <AdminOrderFormSpecialtySettingsPage onCatalogChanged={bumpIframe} />
            </OrderFormSettingsSection>

            <OrderFormSettingsSection
              id="leadSource"
              title="유입경로"
              open={openMap.leadSource}
              onOpenChange={(open) => setSectionOpen('leadSource', open)}
              badge={<OrderFormSettingsCommonBadge />}
            >
              <AdminOrderFormLeadSourceSettingsPage />
            </OrderFormSettingsSection>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminOrderFormCustomerPreviewPage;
