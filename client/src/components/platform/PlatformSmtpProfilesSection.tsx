import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createPlatformSmtpProfile,
  deletePlatformSmtpProfile,
  getPlatformSmtpPurposeCatalog,
  listPlatformSmtpProfiles,
  sendPlatformSmtpProfileTest,
  updatePlatformSmtpProfile,
  type PlatformSmtpProfileDto,
  type PlatformSmtpPurposeCatalogItem,
} from '../../api/platformSmtpProfiles';
import { getPlatformToken } from '../../stores/platformAuth';
import { OutboundEmailSetupWizard } from '../admin/outbound-email/OutboundEmailSetupWizard';
import { TenantSmtpSetupGuideModal } from '../admin/TenantSmtpSetupGuideModal';
import {
  buildSmtpFrom,
  parseSmtpFrom,
  validateOutboundEmailForm,
  firstOutboundEmailValidationMessage,
} from '../../utils/outboundEmailFormHelpers';
import {
  applyOutboundEmailProviderPreset,
  inferOutboundEmailProvider,
  type OutboundEmailProviderId,
} from '../../utils/outboundEmailProviders';
import { OUTBOUND_EMAIL_COPY } from '../../utils/outboundEmailCopy';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  PlatformAlert,
} from '../../utils/platformUi';
import type { OutboundEmailPurpose } from '@shared/outboundEmailPurpose';
import { ModalCloseButton } from '../admin/ModalCloseButton';

type ProfileFormState = {
  slug: string;
  label: string;
  enabled: boolean;
  purposes: OutboundEmailPurpose[];
  defaultDisplayName: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPassword: string;
  smtpPasswordConfigured: boolean;
};

function profileToForm(row: PlatformSmtpProfileDto): ProfileFormState {
  const parsed = parseSmtpFrom(row.smtp.from);
  return {
    slug: row.slug,
    label: row.label,
    enabled: row.enabled,
    purposes: row.purposes,
    defaultDisplayName: row.defaultDisplayName || parsed.displayName,
    smtpHost: row.smtp.host,
    smtpPort: String(row.smtp.port || 587),
    smtpSecure: row.smtp.secure,
    smtpUser: row.smtp.user,
    smtpFrom: row.smtp.from,
    smtpPassword: '',
    smtpPasswordConfigured: row.smtp.passwordConfigured,
  };
}

function emptyForm(): ProfileFormState {
  const preset = applyOutboundEmailProviderPreset('gmail');
  return {
    slug: '',
    label: '',
    enabled: true,
    purposes: [],
    defaultDisplayName: '청소비서',
    smtpHost: preset.host,
    smtpPort: preset.port,
    smtpSecure: preset.secure,
    smtpUser: '',
    smtpFrom: '',
    smtpPassword: '',
    smtpPasswordConfigured: false,
  };
}

export function PlatformSmtpProfilesSection() {
  const [items, setItems] = useState<PlatformSmtpProfileDto[]>([]);
  const [purposeCatalog, setPurposeCatalog] = useState<PlatformSmtpPurposeCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [providerId, setProviderId] = useState<OutboundEmailProviderId>('gmail');
  const [guideOpen, setGuideOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compactGrid, setCompactGrid] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const isNew = editingId === null;

  const parsedFrom = useMemo(() => parseSmtpFrom(form.smtpFrom), [form.smtpFrom]);
  const sendEmail = form.smtpUser || parsedFrom.email;
  const displayName = form.defaultDisplayName || parsedFrom.displayName || '청소비서';

  const patchFromWizard = (patch: {
    providerId?: OutboundEmailProviderId;
    sendEmail?: string;
    displayName?: string;
    smtpPassword?: string;
    smtpHost?: string;
    smtpPort?: string;
    smtpSecure?: boolean;
  }) => {
    if (patch.providerId) setProviderId(patch.providerId);
    setForm((prev) => {
      const nextSend = patch.sendEmail ?? (prev.smtpUser || parseSmtpFrom(prev.smtpFrom).email);
      const nextName = patch.displayName ?? prev.defaultDisplayName;
      const preset = patch.providerId ? applyOutboundEmailProviderPreset(patch.providerId) : null;
      const next: ProfileFormState = {
        ...prev,
        ...(patch.smtpHost !== undefined ? { smtpHost: patch.smtpHost } : preset ? { smtpHost: preset.host } : {}),
        ...(patch.smtpPort !== undefined ? { smtpPort: patch.smtpPort } : preset ? { smtpPort: preset.port } : {}),
        ...(patch.smtpSecure !== undefined ? { smtpSecure: patch.smtpSecure } : preset ? { smtpSecure: preset.secure } : {}),
        ...(patch.sendEmail !== undefined ? { smtpUser: nextSend } : {}),
        ...(patch.displayName !== undefined ? { defaultDisplayName: nextName } : {}),
        ...(patch.smtpPassword !== undefined ? { smtpPassword: patch.smtpPassword } : {}),
      };
      if (patch.displayName !== undefined || patch.sendEmail !== undefined) {
        next.smtpFrom = buildSmtpFrom(nextName, nextSend);
      }
      return next;
    });
    setFieldErrors({});
  };

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) {
      setLoading(false);
      setError('플랫폼 로그인이 필요합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [list, catalog] = await Promise.all([
        listPlatformSmtpProfiles(token),
        getPlatformSmtpPurposeCatalog(token),
      ]);
      setItems(list);
      setPurposeCatalog(catalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setProviderId('gmail');
    setTestEmail('');
    setEditOpen(true);
  };

  const openEdit = (row: PlatformSmtpProfileDto) => {
    setEditingId(row.id);
    setForm(profileToForm(row));
    setProviderId(inferOutboundEmailProvider(row.smtp.host));
    setTestEmail('');
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingId(null);
  };

  const togglePurpose = (id: OutboundEmailPurpose) => {
    setForm((prev) => {
      const has = prev.purposes.includes(id);
      return {
        ...prev,
        purposes: has ? prev.purposes.filter((p) => p !== id) : [...prev.purposes, id],
      };
    });
  };

  const saveProfile = async () => {
    const token = getPlatformToken();
    if (!token) return;
    const smtpFrom = buildSmtpFrom(displayName, sendEmail) || form.smtpFrom.trim();
    const validationError = firstOutboundEmailValidationMessage(
      validateOutboundEmailForm({
        providerId,
        sendEmail,
        displayName,
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        smtpPassword: form.smtpPassword,
        passwordConfigured: form.smtpPasswordConfigured,
      }),
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!form.label.trim()) {
      setError('표시 이름을 입력해 주세요.');
      return;
    }
    if (isNew && !form.slug.trim()) {
      setError('slug(영문 식별자)를 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const smtpPayload = {
        host: form.smtpHost.trim(),
        port: Number(form.smtpPort) || 587,
        secure: form.smtpSecure,
        user: form.smtpUser.trim(),
        from: smtpFrom,
        ...(form.smtpPassword.trim() ? { password: form.smtpPassword } : {}),
      };
      if (isNew) {
        await createPlatformSmtpProfile(token, {
          slug: form.slug.trim(),
          label: form.label.trim(),
          enabled: form.enabled,
          purposes: form.purposes,
          defaultDisplayName: form.defaultDisplayName.trim(),
          smtp: smtpPayload,
        });
      } else {
        await updatePlatformSmtpProfile(token, editingId!, {
          slug: form.slug.trim(),
          label: form.label.trim(),
          enabled: form.enabled,
          purposes: form.purposes,
          defaultDisplayName: form.defaultDisplayName.trim(),
          smtp: smtpPayload,
        });
      }
      closeEdit();
      await load();
      setMessage('SMTP 프로필을 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async (row: PlatformSmtpProfileDto) => {
    if (!window.confirm(`「${row.label}」 SMTP 프로필을 삭제할까요?`)) return;
    const token = getPlatformToken();
    if (!token) return;
    setError('');
    try {
      await deletePlatformSmtpProfile(token, row.id);
      await load();
      setMessage('삭제했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const testProfile = async () => {
    const token = getPlatformToken();
    if (!token || !editingId) return;
    const to = testEmail.trim();
    if (!to) {
      setError('연습 받을 메일 주소를 입력해 주세요.');
      return;
    }
    setTesting(true);
    setError('');
    try {
      const result = await sendPlatformSmtpProfileTest(token, editingId, to);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : '테스트 발송 실패');
    } finally {
      setTesting(false);
    }
  };

  const purposeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of purposeCatalog) m.set(p.id, p.label);
    return m;
  }, [purposeCatalog]);

  if (loading) {
    return <div className="p-4 text-center text-sm text-gray-500">SMTP 프로필 불러오는 중…</div>;
  }

  return (
    <>
      <section className={CARD_SECTION}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">고객·기능별 SMTP 프로필</h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              모든 테넌트의 발주서 제출 확인·현장검수 완료본 등 purpose별 발송 계정을 관리합니다.
              견적서·영수증은 업체별 발송 이메일 설정을 그대로 사용합니다.
            </p>
          </div>
          <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
            프로필 추가
          </button>
        </div>

        {error && !editOpen ? <PlatformAlert variant="error" message={error} /> : null}
        {message ? <PlatformAlert variant="success" message={message} /> : null}

        <div className="mt-4 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-fluid-xs">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-fluid-2xs text-gray-600">
                <th className="px-2 py-2 text-center">이름</th>
                <th className="px-2 py-2 text-center">보내는 주소</th>
                <th className="px-2 py-2 text-center">연결 기능</th>
                <th className="px-2 py-2 text-center">상태</th>
                <th className="px-2 py-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                    등록된 SMTP 프로필이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="px-2 py-2 text-center">
                      <div className="font-medium text-gray-900 truncate" title={row.label}>
                        {row.label}
                      </div>
                      <div className="text-fluid-2xs text-gray-400 truncate" title={row.slug}>
                        {row.slug}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center truncate" title={row.smtp.from}>
                      {row.smtp.from || '—'}
                    </td>
                    <td className="px-2 py-2 text-center text-fluid-2xs leading-snug">
                      {row.purposes.length
                        ? row.purposes.map((p) => purposeLabelMap.get(p) ?? p).join(' · ')
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={
                          row.enabled && row.smtp.configured
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {row.enabled
                          ? row.smtp.configured
                            ? '사용 가능'
                            : 'SMTP 미완료'
                          : '비활성'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-md border border-gray-200 px-2 py-1 text-fluid-2xs hover:bg-gray-50"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeProfile(row)}
                          className="rounded-md border border-red-200 px-2 py-1 text-fluid-2xs text-red-700 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editOpen
        ? createPortal(
            <div
              className="modal-mobile-safe-overlay fixed inset-0 z-[500] flex flex-col justify-end bg-black/40 p-0 sm:flex-row sm:items-center sm:justify-center sm:p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-xl sm:rounded-lg bg-white shadow-lg">
                <div className="shrink-0 border-b border-gray-100 px-4 py-3 sm:px-5">
                  <ModalCloseButton onClick={closeEdit} />
                  <h3 className="text-lg font-semibold text-gray-900 pr-8">
                    {isNew ? 'SMTP 프로필 추가' : 'SMTP 프로필 편집'}
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-4">
                  {error ? <PlatformAlert variant="error" message={error} /> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-fluid-xs">
                      <span className="font-medium text-gray-800">표시 이름</span>
                      <input
                        value={form.label}
                        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                      />
                    </label>
                    <label className="block text-fluid-xs">
                      <span className="font-medium text-gray-800">slug (영문)</span>
                      <input
                        value={form.slug}
                        onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                        disabled={!isNew}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 disabled:bg-gray-50"
                        placeholder="customer-noreply"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-fluid-xs">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    />
                    사용
                  </label>
                  <fieldset className="rounded-lg border border-gray-200 p-3">
                    <legend className="px-1 text-fluid-xs font-medium text-gray-800">
                      연결 기능 (purpose)
                    </legend>
                    <div className="mt-2 space-y-2">
                      {purposeCatalog.map((p) => (
                        <label key={p.id} className="flex items-start gap-2 text-fluid-xs">
                          <input
                            type="checkbox"
                            checked={form.purposes.includes(p.id)}
                            onChange={() => togglePurpose(p.id)}
                            className="mt-0.5"
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setGuideOpen(true)}
                      className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
                    >
                      {OUTBOUND_EMAIL_COPY.guideButton}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompactGrid((v) => !v)}
                      className="text-xs font-medium text-slate-600 underline underline-offset-2"
                    >
                      {compactGrid ? OUTBOUND_EMAIL_COPY.viewWizard : OUTBOUND_EMAIL_COPY.viewAllFields}
                    </button>
                  </div>
                  <OutboundEmailSetupWizard
                    mode="platform"
                    providerId={providerId}
                    onProviderIdChange={(id) => patchFromWizard({ providerId: id })}
                    sendEmail={sendEmail}
                    onSendEmailChange={(v) => patchFromWizard({ sendEmail: v, displayName })}
                    displayName={displayName}
                    onDisplayNameChange={(v) => patchFromWizard({ displayName: v, sendEmail })}
                    smtpPassword={form.smtpPassword}
                    onSmtpPasswordChange={(v) => patchFromWizard({ smtpPassword: v })}
                    passwordConfigured={form.smtpPasswordConfigured}
                    smtpHost={form.smtpHost}
                    onSmtpHostChange={(v) => setForm((f) => ({ ...f, smtpHost: v }))}
                    smtpPort={form.smtpPort}
                    onSmtpPortChange={(v) => setForm((f) => ({ ...f, smtpPort: v }))}
                    smtpSecure={form.smtpSecure}
                    onSmtpSecureChange={(v) => setForm((f) => ({ ...f, smtpSecure: v }))}
                    testEmailTo={testEmail}
                    onTestEmailToChange={setTestEmail}
                    wizardStep={wizardStep}
                    onWizardStepChange={setWizardStep}
                    showAdvanced={showAdvanced}
                    onShowAdvancedChange={setShowAdvanced}
                    compactGrid={compactGrid}
                    fieldErrors={fieldErrors}
                    busy={testing}
                    smtpReady={Boolean(
                      form.smtpHost.trim() &&
                        (buildSmtpFrom(displayName, sendEmail) || form.smtpFrom.trim()) &&
                        (form.smtpPasswordConfigured || form.smtpPassword.trim()),
                    )}
                    onTestOnly={!isNew && editingId ? () => void testProfile() : undefined}
                  />
                </div>
                <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
                  <button type="button" onClick={closeEdit} className={BTN_SECONDARY}>
                    취소
                  </button>
                  <button type="button" disabled={saving} onClick={() => void saveProfile()} className={BTN_PRIMARY}>
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {guideOpen ? (
        <TenantSmtpSetupGuideModal
          onClose={() => setGuideOpen(false)}
          title="SMTP 연결 안내"
          intro="플랫폼 SMTP 프로필 — Gmail 앱 비밀번호 등 연결 방법"
        />
      ) : null}
    </>
  );
}
