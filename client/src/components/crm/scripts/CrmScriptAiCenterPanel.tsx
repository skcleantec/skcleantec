import { useCallback, useEffect, useState } from 'react';
import type { SoomgoBridgeManifest, SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { CrmColumn } from '../layout/CrmShell';
import { CrmSegment, CrmSegmentItem } from '../crmUi';
import { CrmAiSummaryPanel } from '../ai/CrmAiSummaryPanel';
import { CrmAiFontScaleDropdown, useCrmAiFontScale } from '../ai/CrmAiFontScaleDropdown';
import { CrmScriptPanel } from './CrmScriptPanel';

const CENTER_TAB_KEY = 'crm.scriptAiCenterTab';

type CenterTab = 'script' | 'ai';

function readCenterTab(): CenterTab {
  try {
    const raw = localStorage.getItem(CENTER_TAB_KEY);
    if (raw === 'script' || raw === 'ai') return raw;
  } catch {
    /* ignore */
  }
  return 'script';
}

export function CrmScriptAiCenterPanel({
  customerName,
  pyeong,
  estimateWon,
  refreshKey = 0,
  onOpenSettings,
  soomgoEnabled = false,
  tenantSlug,
  bridgeStatus,
  bridgeManifest = null,
  bridgeUp,
  bridgeBusy = false,
  onDispatchNotice,
  inquiryId = null,
  onImportSoomgo,
}: {
  customerName?: string;
  pyeong?: string;
  estimateWon?: number | null;
  refreshKey?: number;
  onOpenSettings?: () => void;
  soomgoEnabled?: boolean;
  tenantSlug?: string | null;
  bridgeStatus?: SoomgoBridgeStatus | null;
  bridgeManifest?: SoomgoBridgeManifest | null;
  bridgeUp: boolean;
  bridgeBusy?: boolean;
  onDispatchNotice?: (message: string) => void;
  inquiryId?: string | null;
  onImportSoomgo?: () => Promise<boolean>;
}) {
  const [tab, setTab] = useState<CenterTab>(() => readCenterTab());
  const [fontScale, setFontScale] = useCrmAiFontScale();

  const selectTab = useCallback((next: CenterTab) => {
    setTab(next);
    try {
      localStorage.setItem(CENTER_TAB_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!soomgoEnabled && tab === 'ai') {
      selectTab('script');
    }
  }, [soomgoEnabled, selectTab, tab]);

  const title = tab === 'ai' ? 'AI 정리' : '상담 스크립트';
  const subtitle =
    tab === 'ai'
      ? '숨고 대화 · PC 저장'
      : 'Ctrl+1~5 · Shift+←→ · 복사';

  return (
    <CrmColumn
      accent="script"
      title={title}
      subtitle={subtitle}
      disableBodyScroll
      bodyClassName="p-0"
      headerAction={
        soomgoEnabled ? (
          <div className="flex flex-wrap items-center gap-1">
            <CrmSegment className="!p-0.5">
              <CrmSegmentItem accent="script" active={tab === 'script'} onClick={() => selectTab('script')} compact>
                스크립트
              </CrmSegmentItem>
              <button
                type="button"
                onClick={() => selectTab('ai')}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
                  tab === 'ai'
                    ? 'crm-ai-shimmer border border-violet-300/70 bg-gradient-to-r from-violet-600 via-sky-500 to-cyan-500 text-white shadow-md shadow-violet-400/35 crm-ai-glow-ring'
                    : 'text-slate-600 hover:bg-white/80'
                }`}
              >
                ✨ AI 정리
              </button>
            </CrmSegment>
            {tab === 'ai' ? (
              <CrmAiFontScaleDropdown value={fontScale} onChange={setFontScale} compact />
            ) : null}
          </div>
        ) : null
      }
    >
      {tab === 'ai' && soomgoEnabled ? (
        <CrmAiSummaryPanel
          tenantSlug={tenantSlug}
          chatId={bridgeStatus?.chatId}
          customerName={customerName}
          inquiryId={inquiryId}
          bridgeStatus={bridgeStatus}
          bridgeManifest={bridgeManifest}
          bridgeUp={bridgeUp}
          bridgeBusy={bridgeBusy}
          onDispatchNotice={onDispatchNotice}
          fontScale={fontScale}
          onImportSoomgo={onImportSoomgo}
        />
      ) : (
        <CrmScriptPanel
          embedded
          customerName={customerName}
          pyeong={pyeong}
          estimateWon={estimateWon}
          refreshKey={refreshKey}
          onOpenSettings={onOpenSettings}
        />
      )}
    </CrmColumn>
  );
}
