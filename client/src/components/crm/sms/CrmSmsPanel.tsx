import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmSmsTemplates,
  fetchTelecrmOrderFormLink,
  uploadTelecrmSmsTemplateImage,
  type TelecrmSmsTemplateDto,
} from '../../../api/telecrmSms';
import { CrmColumn } from '../layout/CrmShell';
import { CrmActionButton, CrmSegment, CrmSegmentItem, crmFieldClass } from '../crmUi';
import { applyTelecrmSmsPlaceholders } from '../../../utils/telecrmSmsPlaceholders';
import { telecrmSms, isTelecrmNativeApp } from '../../../utils/telecrmNativeBridge';

type SmsMode = 'template' | 'live';

export function CrmSmsPanel({
  phone,
  customerName,
  pyeong,
  estimateWon,
  inquiryId,
  customerMatch = 'unknown',
  onDispatchNotice,
  onOpenSettings,
  onOpenOrderIssue,
  refreshKey = 0,
}: {
  phone: string;
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
  inquiryId?: string | null;
  customerMatch?: 'new' | 'existing' | 'pick' | 'unknown';
  onDispatchNotice?: (message: string) => void;
  onOpenSettings?: () => void;
  onOpenOrderIssue?: () => void;
  refreshKey?: number;
}) {
  const token = getToken();
  const [mode, setMode] = useState<SmsMode>('template');
  const [templates, setTemplates] = useState<TelecrmSmsTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveBody, setLiveBody] = useState('');
  const [liveImageUrl, setLiveImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [orderLink, setOrderLink] = useState<string | null>(null);

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
      const res = await fetchTelecrmSmsTemplates(token, { scope: 'work' });
      setTemplates(res.templates);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates, refreshKey]);

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
    const bridgeMode = await telecrmSms(digits, resolved, {
      inquiryId: inquiryId ?? undefined,
      customerMatch,
      imageUrl,
    });
    if (bridgeMode === 'dispatch') onDispatchNotice?.('휴대폰 앱으로 문자를 보냈습니다.');
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

  return (
    <CrmColumn accent="script" title="문자 발송" subtitle="저장 템플릿 선택 또는 직접 작성 · 앱에서 SMS/MMS 전송">
      <div className="space-y-3">
        <CrmSegment accent="script">
          <CrmSegmentItem accent="script" active={mode === 'template'} onClick={() => setMode('template')}>
            저장 템플릿
          </CrmSegmentItem>
          <CrmSegmentItem accent="script" active={mode === 'live'} onClick={() => setMode('live')}>
            직접 작성
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

        {mode === 'template' ? (
          loading ? (
            <p className="text-fluid-sm text-gray-500">템플릿 불러오는 중…</p>
          ) : templates.length === 0 ? (
            <div className="space-y-2">
              <p className="text-fluid-sm text-gray-500">저장된 문자 템플릿이 없습니다.</p>
              {onOpenSettings ? (
                <CrmActionButton accent="script" onClick={onOpenSettings}>
                  템플릿 설정
                </CrmActionButton>
              ) : null}
            </div>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-violet-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-fluid-xs font-semibold text-violet-900">{t.label}</p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-fluid-xs text-gray-700">
                        {applyTelecrmSmsPlaceholders(t.body, placeholderCtx)}
                      </p>
                      {t.imageUrl ? (
                        <img src={t.imageUrl} alt="" className="mt-2 h-16 w-auto rounded-lg border object-cover" />
                      ) : null}
                    </div>
                    <CrmActionButton
                      accent="script"
                      variant="solid"
                      onClick={() => void sendSms(t.body, t.imageUrl)}
                      disabled={!canSend}
                    >
                      {isTelecrmNativeApp() ? '앱 전송' : '전송'}
                    </CrmActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-2">
            <textarea
              value={liveBody}
              onChange={(e) => setLiveBody(e.target.value)}
              rows={5}
              placeholder="지금 보낼 문자 내용을 입력하세요."
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
                  <button
                    type="button"
                    className="text-fluid-xs text-rose-600"
                    onClick={() => setLiveImageUrl(null)}
                  >
                    제거
                  </button>
                </>
              ) : null}
            </div>
            <CrmActionButton
              accent="script"
              variant="solid"
              onClick={() => void sendSms(liveBody, liveImageUrl)}
              disabled={!canSend || (!liveBody.trim() && !liveImageUrl)}
            >
              {isTelecrmNativeApp() ? '앱으로 즉시 전송' : '휴대폰으로 전송'}
            </CrmActionButton>
          </div>
        )}

        {onOpenSettings ? (
          <CrmActionButton accent="script" onClick={onOpenSettings}>
            문자 템플릿 관리
          </CrmActionButton>
        ) : null}
      </div>
    </CrmColumn>
  );
}
