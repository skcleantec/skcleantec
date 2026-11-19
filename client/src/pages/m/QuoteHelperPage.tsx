import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCrmWorkBrand } from '../../hooks/useCrmWorkBrand';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';
import {
  fetchQuickQuoteKinds,
  QuickQuoteForbiddenError,
  type QuickQuoteKind,
} from '../../api/quickQuote';
import { getToken } from '../../stores/auth';
import { Button } from '../../components/ui/Button';
import { QuoteInstallHint } from '../../components/quick-quote/QuoteInstallHint';
import { QuoteTextTab } from '../../components/quick-quote/QuoteTextTab';
import { QuoteAreaTab } from '../../components/quick-quote/QuoteAreaTab';
import { QuoteAiTab } from '../../components/quick-quote/QuoteAiTab';
import { QuoteAddressTab } from '../../components/quick-quote/QuoteAddressTab';
import { QuoteMyPhrasesTab } from '../../components/quick-quote/QuoteMyPhrasesTab';
import { QuotePhraseManager } from '../../components/quick-quote/QuotePhraseManager';
import { useQuotePwaHead } from '../../components/quick-quote/useQuotePwaHead';

type QuoteTab = 'quote' | 'phrases' | 'ai' | 'area' | 'address';

const TABS: { value: QuoteTab; label: string }[] = [
  { value: 'quote', label: '견적 문구' },
  { value: 'phrases', label: '내 문구' },
  { value: 'ai', label: 'AI 견적' },
  { value: 'area', label: '면적' },
  { value: 'address', label: '평수' },
];

function readTab(raw: string | null): QuoteTab {
  if (raw === 'phrases' || raw === 'ai' || raw === 'area' || raw === 'address' || raw === 'quote') return raw;
  return 'quote';
}

export function QuoteHelperPage() {
  useQuotePwaHead();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readTab(searchParams.get('tab'));
  const brand = useCrmWorkBrand();
  const permissions = useMarketerPermissions();
  const [kinds, setKinds] = useState<QuickQuoteKind[]>([]);
  const [kindId, setKindId] = useState('');
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manwon, setManwon] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const setTab = (next: QuoteTab) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', next);
      return params;
    });
  };

  const load = useCallback(async () => {
    const token = getToken();
    const operatingCompanyId = brand.activeOperatingCompanyId;
    if (!token || !operatingCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchQuickQuoteKinds(token, operatingCompanyId);
      setKinds(res.kinds);
      setKindId((prev) => (res.kinds.some((k) => k.id === prev) ? prev : (res.kinds[0]?.id ?? '')));
      setBlocked(false);
    } catch (e) {
      if (e instanceof QuickQuoteForbiddenError) {
        setBlocked(true);
        setKinds([]);
      } else {
        setError(e instanceof Error ? e.message : '견적 문구를 불러오지 못했어요.');
      }
    } finally {
      setLoading(false);
    }
  }, [brand.activeOperatingCompanyId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const role = permissions.me?.role;
  const canUseCrm = role === 'ADMIN' || permissions.has('crm.view');
  const canEdit = permissions.has('crm.settings');

  useEffect(() => {
    if (brand.loading || permissions.loading) return;
    if (role && role !== 'ADMIN' && role !== 'MARKETER') {
      setBlocked(true);
      setLoading(false);
      return;
    }
    if (permissions.me && !canUseCrm) {
      setBlocked(true);
      setLoading(false);
      return;
    }
    void load();
  }, [brand.loading, canUseCrm, load, permissions.loading, permissions.me, role]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas">
      <div className="sticky top-0 z-20">
        <header className="bg-[#121828] text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-2 px-3 py-2">
            <h1 className="shrink-0 text-fluid-sm font-semibold text-white">모바일 CRM</h1>
            <div className="ml-auto flex min-w-0 items-center gap-1">
              {brand.items.length > 0 ? (
                <label className="min-w-0">
                  <span className="sr-only">브랜드</span>
                  <select
                    className="max-w-[8.5rem] truncate rounded-lg bg-white/10 px-2 py-1 text-fluid-xs text-white outline-none"
                    value={brand.active?.slug ?? ''}
                    onChange={(e) => brand.switchBrand(e.target.value)}
                  >
                    {brand.items.map((item) => (
                      <option key={item.operatingCompanyId} value={item.slug} className="text-slate-900">
                        {item.displayName || item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button
                variant="quiet"
                size="sm"
                className="!text-white"
                disabled={blocked || !brand.activeOperatingCompanyId}
                onClick={() => setPhrasesOpen(true)}
              >
                문구 관리
              </Button>
            </div>
          </div>
          <QuoteInstallHint />
        </header>
        <div className="flex border-b border-[#e6ebf2] bg-white" role="tablist" aria-label="모바일 CRM 메뉴">
          {TABS.map((item) => {
            const on = tab === item.value;
            return (
              <Button
                key={item.value}
                variant="quiet"
                size="sm"
                role="tab"
                aria-selected={on}
                className={`min-w-0 flex-1 !rounded-none !border-x-0 !border-t-0 !border-b-2 !bg-transparent !px-0.5 !text-fluid-2xs !shadow-none ${
                  on ? '!border-[#1f4fb8] !font-semibold !text-slate-900' : '!border-transparent !text-slate-500'
                }`}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      {blocked ? (
        <p className="px-4 py-10 text-center text-fluid-sm text-slate-700">CRM 사용이 켜진 계정만 쓸 수 있어요.</p>
      ) : brand.loadError ? (
        <p className="px-4 py-10 text-center text-fluid-sm text-red-600">{brand.loadError}</p>
      ) : !brand.loading && !brand.activeOperatingCompanyId ? (
        <p className="px-4 py-10 text-center text-fluid-sm text-slate-700">브랜드를 선택한 뒤 다시 열어 주세요.</p>
      ) : tab === 'phrases' ? (
        <QuoteMyPhrasesTab canEditShared={canEdit} onToast={setToast} />
      ) : brand.loading || loading ? (
        <p className="px-4 py-10 text-center text-fluid-xs text-slate-500">불러오는 중</p>
      ) : error ? (
        <p className="px-4 py-10 text-center text-fluid-sm text-red-600">{error}</p>
      ) : tab === 'quote' ? (
        <QuoteTextTab
          key={kindId}
          kinds={kinds}
          kindId={kindId}
          onKindId={setKindId}
          manwon={manwon}
          onManwon={setManwon}
          pyeong={pyeong}
          onPyeong={setPyeong}
          onToast={setToast}
        />
      ) : tab === 'area' ? (
        <QuoteAreaTab
          onUsePyeong={(next) => {
            setPyeong(next);
            setTab('quote');
          }}
        />
      ) : tab === 'ai' ? (
        <QuoteAiTab
          operatingCompanyId={brand.activeOperatingCompanyId ?? ''}
          onUseQuote={(nextManwon, nextPyeong) => {
            setManwon(nextManwon);
            setPyeong(nextPyeong);
            setTab('quote');
          }}
        />
      ) : (
        <QuoteAddressTab
          onUsePyeong={(next) => {
            setPyeong(next);
            setTab('quote');
          }}
          onOpenArea={() => setTab('area')}
        />
      )}

      {phrasesOpen && brand.activeOperatingCompanyId ? (
        <QuotePhraseManager
          open
          kinds={kinds}
          canEdit={canEdit}
          operatingCompanyId={brand.activeOperatingCompanyId}
          onClose={() => setPhrasesOpen(false)}
          onSaved={(next) => {
            setKinds(next);
            setKindId((prev) => (next.some((k) => k.id === prev) ? prev : (next[0]?.id ?? '')));
          }}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center px-6">
          <p className="max-w-xs rounded-2xl bg-slate-900/92 px-4 py-3 text-center text-fluid-sm text-white shadow-bar">
            {toast}
          </p>
        </div>
      ) : null}
    </div>
  );
}
