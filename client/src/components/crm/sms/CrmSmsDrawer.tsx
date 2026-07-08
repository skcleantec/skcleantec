import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  createTelecrmSmsTemplate,
  deleteTelecrmSmsTemplate,
  fetchTelecrmOrderFormLink,
  fetchTelecrmSmsTemplates,
  updateTelecrmSmsTemplate,
  uploadTelecrmSmsTemplateImage,
  type TelecrmSmsTemplateDto,
} from '../../../api/telecrmSms';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import { CrmActionButton, CrmIconCopy, CrmSegment, CrmSegmentItem, crmFieldClass } from '../crmUi';
import { applyTelecrmSmsPlaceholders } from '../../../utils/telecrmSmsPlaceholders';
import { telecrmSms, isTelecrmNativeApp, telecrmDispatchNotice } from '../../../utils/telecrmNativeBridge';
import { DeletePasswordModal } from '../settings/DeletePasswordModal';

type DrawerTab = 'send' | 'manage';
type SendMode = 'template' | 'live';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CrmSmsDrawer({
  open,
  onClose,
  phone,
  customerName,
  pyeong,
  estimateWon,
  inquiryId,
  customerMatch = 'unknown',
  onDispatchNotice,
  refreshKey = 0,
  onOpenOrderIssue,
  onTemplatesChanged,
}: {
  open: boolean;
  onClose: () => void;
  phone: string;
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
  inquiryId?: string | null;
  customerMatch?: 'new' | 'existing' | 'pick' | 'unknown';
  onDispatchNotice?: (message: string) => void;
  refreshKey?: number;
  onOpenOrderIssue?: () => void;
  onTemplatesChanged?: () => void;
}) {
  const token = getToken();
  const [tab, setTab] = useState<DrawerTab>('send');
  const [sendMode, setSendMode] = useState<SendMode>('template');
  const [templates, setTemplates] = useState<TelecrmSmsTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveBody, setLiveBody] = useState('');
  const [liveImageUrl, setLiveImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [orderLink, setOrderLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', body: '', imageUrl: '' });
  const [deleteTarget, setDeleteTarget] = useState<TelecrmSmsTemplateDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const canSend = digits.length >= 8;

  const estimateLabel =
    estimateWon != null && Number.isFinite(estimateWon)
      ? `${Number(estimateWon).toLocaleString('ko-KR')}원`
      : undefined;

  const placeholderCtx = useMemo(
    () => ({
      customerName,
      phone,
      pyeong,
      estimate: estimateLabel,
      orderLink,
    }),
    [customerName, phone, pyeong, estimateLabel, orderLink],
  );

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchTelecrmSmsTemplates(token, { scope: 'work', includeInactive: true });
      setTemplates(res.templates.filter((t) => t.isActive));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!open) return;
    void loadTemplates();
  }, [open, loadTemplates, refreshKey]);

  useEffect(() => {
    if (!token || !inquiryId) {
      setOrderLink(null);
      return;
    }
    void fetchTelecrmOrderFormLink(token, inquiryId)
      .then(setOrderLink)
      .catch(() => setOrderLink(null));
  }, [token, inquiryId]);

  const sendSms = async (body: string, imageUrl: string | null) => {
    if (!canSend) {
      onDispatchNotice?.('연락처를 먼저 입력해 주세요.');
      return;
    }
    const resolved = applyTelecrmSmsPlaceholders(body, placeholderCtx);
    if (!resolved.trim() && !imageUrl) {
      onDispatchNotice?.('보낼 문자 내용이 없습니다.');
      return;
    }
    const result = await telecrmSms(digits, resolved, {
      inquiryId: inquiryId ?? undefined,
      customerMatch,
      imageUrl,
    });
    const notice = telecrmDispatchNotice(result, 'sms');
    if (notice) onDispatchNotice?.(notice);
  };

  const copyTemplate = async (t: TelecrmSmsTemplateDto) => {
    const text = applyTelecrmSmsPlaceholders(t.body, placeholderCtx);
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(t.id);
      onDispatchNotice?.('클립보드에 복사했습니다.');
      window.setTimeout(() => setCopiedId(null), 1500);
    } else {
      onDispatchNotice?.('클립보드 복사에 실패했습니다.');
    }
  };

  const onLiveImagePick = async (file: File | null) => {
    if (!file || !token) return;
    setUploading(true);
    try {
      const url = await uploadTelecrmSmsTemplateImage(token, file);
      setLiveImageUrl(url);
    } catch (e) {
      onDispatchNotice?.(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const onFormImagePick = async (file: File | null) => {
    if (!file || !token) return;
    setBusy(true);
    try {
      const url = await uploadTelecrmSmsTemplateImage(token, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      setManageError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ label: '', body: '', imageUrl: '' });
    setManageError(null);
  };

  const saveTemplate = async () => {
    if (!token || !form.label.trim() || !form.body.trim()) return;
    setBusy(true);
    setManageError(null);
    try {
      if (editId) {
        await updateTelecrmSmsTemplate(token, editId, {
          label: form.label.trim(),
          body: form.body.trim(),
          imageUrl: form.imageUrl.trim() || null,
        });
      } else {
        await createTelecrmSmsTemplate(token, {
          label: form.label.trim(),
          body: form.body.trim(),
          imageUrl: form.imageUrl.trim() || null,
          ownerScope: 'personal',
        });
      }
      resetForm();
      await loadTemplates();
      onTemplatesChanged?.();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (t: TelecrmSmsTemplateDto) => {
    setEditId(t.id);
    setForm({ label: t.label, body: t.body, imageUrl: t.imageUrl ?? '' });
    setTab('manage');
  };

  return (
    <>
      <CrmSlideDrawer
        open={open}
        onClose={onClose}
        title="문자 발송"
        subtitle="전송 · 클립보드 복사 · 문구 관리"
        widthClass="w-[min(440px,94vw)]"
      >
        <div className="space-y-4">
          <CrmSegment accent="script">
            <CrmSegmentItem accent="script" active={tab === 'send'} onClick={() => setTab('send')}>
              발송
            </CrmSegmentItem>
            <CrmSegmentItem accent="script" active={tab === 'manage'} onClick={() => setTab('manage')}>
              문구 관리
            </CrmSegmentItem>
          </CrmSegment>

          <p className="text-[10px] leading-relaxed text-slate-500">
            치환: {'{고객명}'} {'{연락처}'} {'{평수}'} {'{예상가}'} {'{발주서링크}'}
            {inquiryId && !orderLink ? (
              <button type="button" className="ml-1 text-violet-700 underline" onClick={onOpenOrderIssue}>
                발주서 발급 후 링크 사용
              </button>
            ) : null}
          </p>

          {tab === 'send' ? (
            <div className="space-y-3">
              <CrmSegment accent="script">
                <CrmSegmentItem accent="script" active={sendMode === 'template'} onClick={() => setSendMode('template')}>
                  저장 문구
                </CrmSegmentItem>
                <CrmSegmentItem accent="script" active={sendMode === 'live'} onClick={() => setSendMode('live')}>
                  직접 작성
                </CrmSegmentItem>
              </CrmSegment>

              {sendMode === 'template' ? (
                loading ? (
                  <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
                ) : templates.length === 0 ? (
                  <p className="text-fluid-sm text-gray-500">
                    저장된 문구가 없습니다. 「문구 관리」 탭에서 추가하세요.
                  </p>
                ) : (
                  <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-1">
                    {templates.map((t) => {
                      const preview = applyTelecrmSmsPlaceholders(t.body, placeholderCtx);
                      return (
                        <li key={t.id} className="rounded-xl border border-violet-100 bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-fluid-xs font-semibold text-violet-900">{t.label}</p>
                              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-fluid-xs text-gray-700">
                                {preview}
                              </p>
                              {t.imageUrl ? (
                                <img src={t.imageUrl} alt="" className="mt-2 h-16 w-auto rounded-lg border object-cover" />
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <CrmActionButton
                              accent="script"
                              variant="solid"
                              onClick={() => void sendSms(t.body, t.imageUrl)}
                              disabled={!canSend}
                            >
                              {isTelecrmNativeApp() ? '앱 전송' : '전송'}
                            </CrmActionButton>
                            <CrmActionButton accent="script" onClick={() => void copyTemplate(t)}>
                              <CrmIconCopy className="mr-1 inline h-3.5 w-3.5" />
                              {copiedId === t.id ? '복사됨' : '클립보드'}
                            </CrmActionButton>
                            <button
                              type="button"
                              className="text-fluid-xs text-violet-700 underline"
                              onClick={() => startEdit(t)}
                            >
                              수정
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={liveBody}
                    onChange={(e) => setLiveBody(e.target.value)}
                    rows={6}
                    placeholder="지금 보낼 문자 내용"
                    className={crmFieldClass}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-fluid-xs font-medium text-violet-800 hover:bg-violet-100">
                      {uploading ? '업로드 중…' : '사진 첨부'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => void onLiveImagePick(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {liveImageUrl ? (
                      <>
                        <img src={liveImageUrl} alt="" className="h-12 rounded border object-cover" />
                        <button type="button" className="text-fluid-xs text-rose-600" onClick={() => setLiveImageUrl(null)}>
                          제거
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CrmActionButton
                      accent="script"
                      variant="solid"
                      onClick={() => void sendSms(liveBody, liveImageUrl)}
                      disabled={!canSend || (!liveBody.trim() && !liveImageUrl)}
                    >
                      {isTelecrmNativeApp() ? '앱으로 전송' : '휴대폰으로 전송'}
                    </CrmActionButton>
                    <CrmActionButton
                      accent="script"
                      onClick={() => void copyText(applyTelecrmSmsPlaceholders(liveBody, placeholderCtx))}
                      disabled={!liveBody.trim()}
                    >
                      클립보드 복사
                    </CrmActionButton>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                <p className="mb-2 text-fluid-xs font-semibold text-violet-900">
                  {editId ? '문구 수정' : '새 문구 추가'}
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="이름 (예: 발주서 안내)"
                    className={crmFieldClass}
                  />
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={5}
                    placeholder="클립보드·문자에 쓸 본문"
                    className={crmFieldClass}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-fluid-xs">
                      사진
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void onFormImagePick(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {form.imageUrl ? (
                      <>
                        <img src={form.imageUrl} alt="" className="h-12 rounded border object-cover" />
                        <button
                          type="button"
                          className="text-fluid-xs text-rose-600"
                          onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                        >
                          제거
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CrmActionButton
                      accent="script"
                      variant="solid"
                      disabled={busy || !form.label.trim() || !form.body.trim()}
                      onClick={() => void saveTemplate()}
                    >
                      {editId ? '수정 저장' : '추가'}
                    </CrmActionButton>
                    {editId ? (
                      <CrmActionButton accent="script" onClick={resetForm}>
                        취소
                      </CrmActionButton>
                    ) : null}
                  </div>
                </div>
              </div>

              {manageError ? <p className="text-fluid-xs text-red-600">{manageError}</p> : null}

              {loading ? (
                <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li key={t.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <p className="text-fluid-xs font-semibold text-gray-900">{t.label}</p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-fluid-xs text-gray-600">{t.body}</p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button type="button" className="text-fluid-xs text-violet-700" onClick={() => startEdit(t)}>
                          수정
                        </button>
                        <button
                          type="button"
                          className="text-fluid-xs text-rose-600"
                          onClick={() => {
                            setDeleteTarget(t);
                            setDeletePassword('');
                            setDeleteError(null);
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CrmSlideDrawer>

      <DeletePasswordModal
        open={Boolean(deleteTarget)}
        title="문자 문구 삭제"
        password={deletePassword}
        error={deleteError}
        onPasswordChange={setDeletePassword}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!token || !deleteTarget) return;
          try {
            await deleteTelecrmSmsTemplate(token, deleteTarget.id, deletePassword);
            setDeleteTarget(null);
            if (editId === deleteTarget.id) resetForm();
            await loadTemplates();
            onTemplatesChanged?.();
          } catch (e) {
            setDeleteError(e instanceof Error ? e.message : '삭제 실패');
          }
        }}
      />
    </>
  );
}
