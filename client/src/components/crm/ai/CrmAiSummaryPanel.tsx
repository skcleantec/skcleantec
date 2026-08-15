import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SoomgoBridgeManifest, SoomgoBridgeStatus, SoomgoChatTranscript } from '@shared/soomgoBridge';
import {
  extractSoomgoChatTranscript,
  fetchSoomgoChatTranscript,
  isSoomgoBridgeAiTranscriptSupported,
  isSoomgoBridgeReachable,
  isSoomgoBridgeUseBlocked,
  sendSoomgoBridgeMessage,
  SOOMGO_BRIDGE_AI_TRANSCRIPT_OUTDATED_MESSAGE,
  SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
  soomgoBridgeOutdatedMessage,
} from '../../../api/soomgoBridge';
import {
  fetchTelecrmAiChatSummary,
  fetchTelecrmAiUsageMonth,
  type TelecrmAiNextActionDto,
  type TelecrmAiUsageSnapshotDto,
  type TelecrmChatSummaryDto,
} from '../../../api/telecrm';
import { filterSoomgoChatMessages } from '@shared/soomgoChatTranscriptNoise';
import { getToken } from '../../../stores/auth';
import {
  clearCrmAiSummarySession,
  loadCrmAiSummarySession,
  saveCrmAiSummarySession,
} from '../../../utils/crmAiSummarySession';
import { formatCrmAiActionLabel } from '../../../utils/crmAiActionLabels';
import { CRM_ACCENT, CrmIconCopy, CrmSectionLabel } from '../crmUi';

function fmtExtractedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function roleLabel(role: string): string {
  if (role === 'customer') return '고객';
  if (role === 'pro') return '고수';
  return role;
}

function resolveFetchBlockReason(
  bridgeStatus: SoomgoBridgeStatus | null | undefined,
  bridgeManifest: SoomgoBridgeManifest | null | undefined,
  bridgeUp: boolean,
): string | null {
  if (!bridgeUp || !isSoomgoBridgeReachable(bridgeStatus)) {
    return SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE;
  }
  if (isSoomgoBridgeUseBlocked(bridgeStatus, bridgeManifest)) {
    return soomgoBridgeOutdatedMessage(bridgeStatus, bridgeManifest);
  }
  if (!isSoomgoBridgeAiTranscriptSupported(bridgeStatus)) {
    return SOOMGO_BRIDGE_AI_TRANSCRIPT_OUTDATED_MESSAGE;
  }
  if (!bridgeStatus?.inChatRoom) {
    return '숨고 Chrome에서 채팅방을 연 뒤 「대화 가져오기」를 눌러 주세요.';
  }
  return null;
}

function SummaryCard({
  title,
  body,
  copyText,
  fontScale,
}: {
  title: string;
  body: ReactNode;
  copyText?: string;
  fontScale: number;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!copyText?.trim()) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className={`rounded-xl border p-2 shadow-sm ${CRM_ACCENT.soomgo.panel}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-sky-900" style={{ fontSize: `${fontScale * 1.05}rem` }}>
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {copyText ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-0.5 rounded border border-sky-200 bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-sky-800 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
          >
            <CrmIconCopy className="h-3 w-3" />
            {copied ? '복사됨' : '복사'}
          </button>
        ) : null}
        </div>
      </div>
      <div className="leading-snug text-slate-800" style={{ fontSize: `${fontScale}rem` }}>
        {body}
      </div>
    </div>
  );
}

function normalizeNextActions(raw: TelecrmAiNextActionDto[] | string[] | undefined): TelecrmAiNextActionDto[] {
  if (!raw?.length) return [];
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map((action) => ({
      action: formatCrmAiActionLabel(action),
      suggestedReply: '',
    }));
  }
  return (raw as TelecrmAiNextActionDto[]).map((item) => ({
    action: formatCrmAiActionLabel(item.action),
    suggestedReply: item.suggestedReply ?? '',
  }));
}

function NextActionPanel({
  actions,
  bridgeInChatRoom,
  onNotice,
  fontScale,
}: {
  actions: TelecrmAiNextActionDto[];
  bridgeInChatRoom: boolean;
  onNotice?: (message: string) => void;
  fontScale: number;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafts, setDrafts] = useState<string[]>(() => actions.map((a) => a.suggestedReply?.trim() || ''));

  useEffect(() => {
    setDrafts(actions.map((a) => a.suggestedReply?.trim() || ''));
    setSelectedIdx(0);
  }, [actions]);

  const safeIdx = selectedIdx >= 0 && selectedIdx < actions.length ? selectedIdx : 0;
  const selected = actions[safeIdx];
  const replyText = (drafts[safeIdx] ?? selected?.suggestedReply ?? '').trim();

  const updateDraft = (text: string) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[safeIdx] = text;
      return next;
    });
  };

  const copyReply = async () => {
    if (!replyText) return;
    try {
      await navigator.clipboard.writeText(replyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      onNotice?.('복사에 실패했습니다.');
    }
  };

  const sendReply = async () => {
    if (!replyText) {
      onNotice?.('보낼 답장 문구가 없습니다.');
      return;
    }
    if (!bridgeInChatRoom) {
      onNotice?.('숨고 Chrome에서 채팅방을 연 뒤 보내 주세요.');
      return;
    }
    setSending(true);
    try {
      await sendSoomgoBridgeMessage(replyText);
      onNotice?.('숨고 채팅방으로 보냈습니다.');
    } catch (e) {
      onNotice?.(e instanceof Error ? e.message : '메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`rounded-xl border p-2 shadow-sm ${CRM_ACCENT.soomgo.panel} crm-ai-glow-ring`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-sky-900" style={{ fontSize: `${fontScale * 1.05}rem` }}>
          다음 액션 · 추천 답장
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {actions.map((item, idx) => (
          <button
            key={`${item.action}-${idx}`}
            type="button"
            onClick={() => setSelectedIdx(idx)}
            className={`max-w-full rounded-lg border px-2 py-1 text-left leading-snug transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
              safeIdx === idx
                ? 'border-violet-400 bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-md shadow-violet-300/40'
                : 'border-sky-200 bg-white/90 text-sky-900 hover:border-sky-300 hover:bg-sky-50'
            }`}
            style={{ fontSize: `${fontScale}rem` }}
          >
            {item.action}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="mt-2 space-y-1.5 rounded-lg border border-violet-100/90 bg-gradient-to-br from-white via-sky-50/40 to-violet-50/30 p-2">
          <p className="font-medium text-violet-900" style={{ fontSize: `${fontScale}rem` }}>
            {selected.action}
          </p>
          <label className="block">
            <span className="mb-0.5 block text-slate-500" style={{ fontSize: `${fontScale * 0.9}rem` }}>
              추천 답장 (수정 후 전송 가능)
            </span>
            <textarea
              value={drafts[safeIdx] ?? ''}
              onChange={(e) => updateDraft(e.target.value)}
              rows={5}
              className="modal-form-scroll-surface w-full min-h-[5.5rem] resize-y rounded-lg border border-sky-200 bg-white/95 px-2 py-1.5 leading-snug text-slate-800 shadow-inner focus-visible:border-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
              style={{ fontSize: `${fontScale}rem` }}
              placeholder="AI 추천 답장이 여기 표시됩니다. 원하시는 대로 고친 뒤 보내세요."
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => void copyReply()}
              disabled={!replyText}
              className="inline-flex items-center gap-0.5 rounded-lg border border-sky-200 bg-white px-2 py-1 font-medium text-sky-800 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1 disabled:opacity-50"
              style={{ fontSize: `${fontScale * 0.9}rem` }}
            >
              <CrmIconCopy className="h-3 w-3" />
              {copied ? '복사됨' : '복사'}
            </button>
            <button
              type="button"
              onClick={() => updateDraft(selected.suggestedReply?.trim() || '')}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1"
              style={{ fontSize: `${fontScale * 0.9}rem` }}
            >
              AI 원문
            </button>
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={!replyText || sending || !bridgeInChatRoom}
              className="rounded-lg bg-gradient-to-r from-violet-600 via-sky-500 to-cyan-500 px-3 py-1 font-semibold text-white shadow-md shadow-sky-400/30 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"
              style={{ fontSize: `${fontScale * 0.95}rem` }}
            >
              {sending ? '전송 중…' : '✨ 숨고 보내기'}
            </button>
          </div>
          {!bridgeInChatRoom ? (
            <p className="text-amber-700" style={{ fontSize: `${fontScale * 0.85}rem` }}>
              숨고 채팅방을 연 뒤 「숨고 보내기」를 사용할 수 있습니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CrmAiSummaryPanel({
  tenantSlug,
  chatId,
  customerName,
  inquiryId,
  bridgeStatus,
  bridgeManifest = null,
  bridgeUp,
  bridgeBusy = false,
  onDispatchNotice,
  fontScale,
}: {
  tenantSlug?: string | null;
  chatId?: string | null;
  customerName?: string;
  inquiryId?: string | null;
  bridgeStatus?: SoomgoBridgeStatus | null;
  bridgeManifest?: SoomgoBridgeManifest | null;
  bridgeUp: boolean;
  bridgeBusy?: boolean;
  onDispatchNotice?: (message: string) => void;
  fontScale: number;
}) {
  const token = getToken();
  const [transcript, setTranscript] = useState<SoomgoChatTranscript | null>(null);
  const [summary, setSummary] = useState<TelecrmChatSummaryDto | null>(null);
  const [monthUsage, setMonthUsage] = useState<TelecrmAiUsageSnapshotDto | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryContentHash, setSummaryContentHash] = useState<string | null>(null);
  const [selectedActionReset, setSelectedActionReset] = useState(0);

  const slug = tenantSlug?.trim() || undefined;
  const activeChatId = chatId?.trim() || bridgeStatus?.chatId?.trim() || null;
  const extractBusy = fetching || Boolean(bridgeStatus?.extractInProgress) || bridgeBusy;
  const extractBlockedByPeer = Boolean(bridgeStatus?.extractInProgress) && !fetching;

  const blockReason = useMemo(
    () => resolveFetchBlockReason(bridgeStatus, bridgeManifest, bridgeUp),
    [bridgeManifest, bridgeStatus, bridgeUp],
  );

  const loadMonthUsage = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchTelecrmAiUsageMonth(token);
      setMonthUsage(res);
    } catch {
      setMonthUsage(null);
    }
  }, [token]);

  const loadCached = useCallback(async () => {
    if (!activeChatId) {
      setTranscript(null);
      setSummary(null);
      setSummaryContentHash(null);
      return;
    }
    setLoadingCache(true);
    setError(null);
    try {
      const data = await fetchSoomgoChatTranscript(activeChatId, slug);
      setTranscript(data);
      if (data) {
        const cached = loadCrmAiSummarySession(slug, data.chatId, data.contentHash);
        setSummary(cached);
        setSummaryContentHash(cached ? data.contentHash : null);
      } else {
        setSummary(null);
        setSummaryContentHash(null);
      }
    } catch (e) {
      setTranscript(null);
      setError(e instanceof Error ? e.message : '저장된 대화를 불러올 수 없습니다.');
    } finally {
      setLoadingCache(false);
    }
  }, [activeChatId, slug]);

  useEffect(() => {
    void loadCached();
  }, [loadCached]);

  useEffect(() => {
    void loadMonthUsage();
  }, [loadMonthUsage, summary]);

  const handleFetchTranscript = async () => {
    if (blockReason) {
      onDispatchNotice?.(blockReason);
      return;
    }
    setFetching(true);
    setError(null);
    const prevHash = transcript?.contentHash ?? null;
    try {
      const data = await extractSoomgoChatTranscript({ tenantSlug: slug });
      setTranscript(data);
      if (prevHash && prevHash !== data.contentHash) {
        setSummary(null);
        setSummaryContentHash(null);
        clearCrmAiSummarySession(slug, data.chatId, prevHash);
        onDispatchNotice?.(`숨고 대화 ${data.messageCount}건을 저장했습니다. AI 정리를 다시 실행해 주세요.`);
      } else if (prevHash === data.contentHash) {
        onDispatchNotice?.('대화 내용 변경 없음 — 기존 저장본을 사용합니다.');
      } else {
        onDispatchNotice?.(`숨고 대화 ${data.messageCount}건을 PC에 저장했습니다.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '대화 가져오기에 실패했습니다.';
      setError(msg);
      onDispatchNotice?.(msg);
    } finally {
      setFetching(false);
    }
  };

  const handleSummarize = async () => {
    if (!token) return;
    if (!transcript || transcript.messages.length === 0) {
      onDispatchNotice?.('먼저 「대화 가져오기」로 대화를 수집해 주세요.');
      return;
    }
    setSummarizing(true);
    setError(null);
    try {
      const data = await fetchTelecrmAiChatSummary(token, {
        source: 'soomgo',
        chatId: transcript.chatId,
        inquiryId: inquiryId ?? null,
        customerName: customerName ?? transcript.nickname,
        messages: transcript.messages,
        contentHash: transcript.contentHash,
      });
      setSummary(data);
      setSummaryContentHash(transcript.contentHash);
      setSelectedActionReset((n) => n + 1);
      saveCrmAiSummarySession(slug, transcript.chatId, transcript.contentHash, data);
      setMonthUsage(data.monthUsage);
      onDispatchNotice?.('AI 정리를 완료했습니다.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI 정리에 실패했습니다.';
      setError(msg);
      onDispatchNotice?.(msg);
    } finally {
      setSummarizing(false);
    }
  };

  const aiLimitReached =
    monthUsage != null && !monthUsage.unlimited && monthUsage.remaining != null && monthUsage.remaining <= 0;
  const aiDisabled = monthUsage != null && !monthUsage.enabled;

  const monthUsageLabel = useMemo(() => {
    if (!monthUsage) return null;
    if (!monthUsage.enabled) return 'AI 정리 비활성';
    if (monthUsage.unlimited) return `이번 달 AI ${monthUsage.count}회`;
    return `이번 달 AI ${monthUsage.count}/${monthUsage.limit}회`;
  }, [monthUsage]);

  const summaryStale =
    Boolean(summary) &&
    Boolean(transcript?.contentHash) &&
    summaryContentHash != null &&
    transcript!.contentHash !== summaryContentHash;

  const aiButtonLabel = summarizing
    ? '정리 중…'
    : summary && !summaryStale
      ? 'AI 재정리'
      : 'AI 정리';

  const statusLabel = extractBusy
    ? '추출 중…'
    : summarizing
      ? '정리 중…'
      : transcript
        ? `로컬 ${transcript.messageCount}건 · ${fmtExtractedAt(transcript.extractedAt)}`
        : activeChatId
          ? '미수집'
          : '채팅방 미연결';

  const suggestedReplyCopy = summary?.suggestedReply?.trim() || '';
  const nextActions = useMemo(
    () => normalizeNextActions(summary?.nextActions as TelecrmAiNextActionDto[] | string[] | undefined),
    [summary?.nextActions],
  );
  const previewMessages = useMemo(
    () => (transcript ? filterSoomgoChatMessages(transcript.messages) : []),
    [transcript],
  );
  const summaryCopy = summary
    ? [
        summary.summary,
        summary.customerQuestions.length
          ? `고객 질문:\n${summary.customerQuestions.map((q) => `- ${q}`).join('\n')}`
          : '',
        nextActions.length
          ? `다음 액션:\n${nextActions.map((a) => `- ${a.action}${a.suggestedReply ? `\n  ${a.suggestedReply}` : ''}`).join('\n')}`
          : '',
        suggestedReplyCopy ? `답장 초안:\n${suggestedReplyCopy}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-100/80 bg-gradient-to-r from-sky-50/90 via-violet-50/40 to-cyan-50/50 px-2 py-1.5"
        style={{ fontSize: `${fontScale}rem` }}
      >
        <div className="min-w-0 flex-1">
          <CrmSectionLabel accent="soomgo">숨고 대화 · AI 정리</CrmSectionLabel>
          <p className="truncate text-slate-600" title={statusLabel} style={{ fontSize: `${fontScale * 0.95}rem` }}>
            {statusLabel}
            {customerName ? ` · ${customerName}` : null}
            {activeChatId ? ` · #${activeChatId}` : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <button
            type="button"
            onClick={() => void handleFetchTranscript()}
            disabled={extractBusy || summarizing || Boolean(blockReason)}
            className="rounded-lg border border-sky-300/80 bg-gradient-to-r from-sky-500 to-cyan-500 px-2.5 py-1 font-semibold text-white shadow-md shadow-sky-400/30 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
            style={{ fontSize: `${fontScale}rem` }}
          >
            {extractBusy ? '가져오는 중…' : '📥 대화 가져오기'}
          </button>
          <button
            type="button"
            onClick={() => void handleSummarize()}
            disabled={extractBusy || summarizing || !transcript || aiLimitReached || aiDisabled}
            className={`rounded-lg border border-violet-300/80 px-2.5 py-1 font-semibold text-white shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 ${
              summarizing
                ? 'crm-ai-shimmer bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 shadow-violet-400/40'
                : 'bg-gradient-to-r from-violet-600 via-sky-500 to-cyan-500 shadow-sky-400/30 hover:brightness-105 crm-ai-glow-ring'
            }`}
            style={{ fontSize: `${fontScale}rem` }}
          >
            {summarizing ? '✨ 정리 중…' : `✨ ${aiButtonLabel}`}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-2 py-1.5">
        {extractBlockedByPeer ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50/80 px-2 py-1.5 text-[11px] leading-snug text-sky-900">
            숨고 정보 가져오기가 진행 중입니다. 완료 후 대화 가져오기를 실행해 주세요.
          </p>
        ) : null}
        {blockReason ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
            {blockReason}
          </p>
        ) : null}

        {aiDisabled ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
            이 업체는 CRM AI 정리 기능이 비활성화되어 있습니다.
          </p>
        ) : null}
        {aiLimitReached ? (
          <p className="rounded-lg border border-red-200 bg-red-50/80 px-2 py-1.5 text-[11px] leading-snug text-red-900">
            이번 달 AI 정리 한도({monthUsage?.limit}회)를 모두 사용했습니다.
          </p>
        ) : null}

        {loadingCache ? (
          <p className="text-[11px] text-gray-500">저장된 대화 확인 중…</p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">{error}</p>
        ) : null}

        {!blockReason && !transcript && !loadingCache && !error ? (
          <p className="text-[11px] leading-snug text-gray-500">
            숨고 채팅방을 연 뒤 「대화 가져오기」→ 「AI 정리」 순서로 사용합니다.
          </p>
        ) : null}

        {summaryStale ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
            대화가 변경되었습니다. 「AI 재정리」를 실행해 주세요.
          </p>
        ) : null}

        {summary && !summaryStale ? (
          <div className="space-y-1.5">
            <SummaryCard
              title="한 줄 요약"
              body={summary.summary}
              copyText={summaryCopy}
              fontScale={fontScale}
            />
            {summary.customerQuestions.length > 0 ? (
              <SummaryCard
                title="고객 핵심 질문"
                copyText={summary.customerQuestions.map((q) => `- ${q}`).join('\n')}
                fontScale={fontScale}
                body={
                  <ul className="list-inside list-disc space-y-0.5">
                    {summary.customerQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                }
              />
            ) : null}
            {nextActions.length > 0 ? (
              <NextActionPanel
                key={selectedActionReset}
                actions={nextActions}
                bridgeInChatRoom={Boolean(bridgeStatus?.inChatRoom)}
                onNotice={onDispatchNotice}
                fontScale={fontScale}
              />
            ) : null}
            {suggestedReplyCopy && nextActions.every((a) => !a.suggestedReply.trim()) ? (
              <SummaryCard
                title="답장 초안"
                body={suggestedReplyCopy}
                copyText={suggestedReplyCopy}
                fontScale={fontScale}
              />
            ) : null}
            {summary.warnings?.length ? (
              <p className="text-[10px] leading-snug text-amber-800">
                {summary.warnings.join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {transcript ? (
          <details className={`rounded-xl border shadow-sm ${CRM_ACCENT.soomgo.panel} crm-ai-glow-ring`}>
            <summary
              className="cursor-pointer select-none list-none px-2 py-1.5 font-semibold text-sky-900 [&::-webkit-details-marker]:hidden"
              style={{ fontSize: `${fontScale * 1.05}rem` }}
            >
              대화 미리보기 ({previewMessages.length}건)
            </summary>
            <div className="max-h-[min(280px,40vh)] space-y-1 overflow-y-auto border-t border-sky-100/80 px-2 py-1.5">
              {previewMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}-${msg.text.slice(0, 24)}`}
                  className={`rounded-md px-2 py-1 leading-snug ${
                    msg.role === 'customer'
                      ? 'bg-white/90 text-slate-800'
                      : 'bg-sky-100/70 text-slate-800'
                  }`}
                  style={{ fontSize: `${fontScale}rem` }}
                >
                  <span
                    className={`mr-1.5 inline-block rounded px-1 py-0 font-semibold ${
                      msg.role === 'customer' ? 'bg-slate-200 text-slate-700' : 'bg-sky-600 text-white'
                    }`}
                    style={{ fontSize: `${fontScale * 0.85}rem` }}
                  >
                    {roleLabel(msg.role)}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{msg.text}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {monthUsageLabel ? (
          <p
            className={`text-[10px] tabular-nums ${
              aiLimitReached ? 'text-red-500' : aiDisabled ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            {monthUsageLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
