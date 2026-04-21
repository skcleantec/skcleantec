import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getActiveAdSession,
  getAdChannels,
  startAdSession,
  endAdSession,
  type ActiveSession,
  type AdChannel,
  type EndAdSessionLine,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';
import { ModalCloseButton } from './ModalCloseButton';
import {
  isSoomgoChannelName,
  SOOMGO_WON_PER_AUTO_ESTIMATE,
  SOOMGO_WON_PER_RECEIVED_REQUEST,
} from '../../constants/soomgoAd';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

type SoomgoForm = { received: string; autoEstimate: string; confirmed: string };

export function TelemarketingSessionBlock() {
  const token = getToken();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [soomgoForm, setSoomgoForm] = useState<Record<string, SoomgoForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const autoStartAttempted = useRef(false);
  const prevHadSession = useRef(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [active, chRes] = await Promise.all([getActiveAdSession(token), getAdChannels(token)]);
      setSession(active.session);
      const activeCh = chRes.items.filter((c) => c.isActive);
      setChannels(activeCh);
      const initAmt: Record<string, string> = {};
      const initSg: Record<string, SoomgoForm> = {};
      for (const c of activeCh) {
        initAmt[c.id] = '';
        if (isSoomgoChannelName(c.name)) {
          initSg[c.id] = { received: '', autoEstimate: '', confirmed: '' };
        }
      }
      setAmounts(initAmt);
      setSoomgoForm(initSg);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 작업 종료 후 다시 자동 시작하려면 시도 플래그 초기화 */
  useEffect(() => {
    if (prevHadSession.current && !session) {
      autoStartAttempted.current = false;
    }
    prevHadSession.current = Boolean(session);
  }, [session]);

  /** 시작 버튼 없이 대시보드 진입 시 세션 자동 생성 */
  useEffect(() => {
    if (!token || loading || channels.length === 0) return;
    if (session) return;
    if (autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        await startAdSession(token);
      } catch {
        /* 이미 진행 중 등 */
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loading, session, channels.length, refresh]);

  const handleOpenEnd = () => {
    setModalOpen(true);
  };

  const handleEnd = async () => {
    if (!token) return;
    const lines: EndAdSessionLine[] = [];

    for (const c of channels) {
      if (isSoomgoChannelName(c.name)) {
        const f = soomgoForm[c.id] ?? { received: '', autoEstimate: '', confirmed: '' };
        const received = Math.max(0, Math.floor(Number(String(f.received).replace(/[^\d]/g, '')) || 0));
        const autoEstimate = Math.max(0, Math.floor(Number(String(f.autoEstimate).replace(/[^\d]/g, '')) || 0));
        const confirmed = Math.max(0, Math.floor(Number(String(f.confirmed).replace(/[^\d]/g, '')) || 0));
        if (received === 0 && autoEstimate === 0) continue;
        lines.push({
          channelId: c.id,
          soomgo: { received, autoEstimate, confirmed },
        });
      } else {
        const amt = Math.max(0, Math.round(Number(String(amounts[c.id] ?? '').replace(/,/g, '')) || 0));
        if (amt > 0) lines.push({ channelId: c.id, amount: amt });
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await endAdSession(token, lines);
      setModalOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '종료 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  const soomgoPreview = (c: AdChannel) => {
    const f = soomgoForm[c.id] ?? { received: '', autoEstimate: '', confirmed: '' };
    const received = Math.max(0, Math.floor(Number(String(f.received).replace(/[^\d]/g, '')) || 0));
    const autoEstimate = Math.max(0, Math.floor(Number(String(f.autoEstimate).replace(/[^\d]/g, '')) || 0));
    const confirmed = Math.max(0, Math.floor(Number(String(f.confirmed).replace(/[^\d]/g, '')) || 0));
    const totalAd =
      received * SOOMGO_WON_PER_RECEIVED_REQUEST + autoEstimate * SOOMGO_WON_PER_AUTO_ESTIMATE;
    const avgPerConfirmed = confirmed > 0 ? totalAd / confirmed : null;
    return { received, autoEstimate, confirmed, totalAd, avgPerConfirmed };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-base font-medium text-gray-800 mb-2">텔레마케팅 · 광고비</h2>
      <p className="text-sm text-gray-600 mb-4">
        업무 종료 시 채널별로 당일 광고비를 저장합니다. 숨고는 건수만 입력하면 단가가 자동 적용됩니다.
      </p>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : session ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenEnd}
            disabled={submitting || channels.length === 0}
            className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-900 disabled:opacity-50"
          >
            작업 종료 및 정산
          </button>
          {channels.length === 0 && (
            <span className="text-xs text-amber-700">
              채널이 없습니다. 광고비 메뉴에서 최고 관리자가 채널을 추가하세요.
            </span>
          )}
        </div>
      ) : channels.length === 0 ? (
        <p className="text-sm text-gray-500">활성 광고 채널이 없습니다. 관리자가 광고비 메뉴에서 채널을 추가할 수 있습니다.</p>
      ) : (
        <p className="text-sm text-gray-500">세션 준비 중… 잠시 후 새로고침해 주세요.</p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <ModalCloseButton onClick={() => setModalOpen(false)} disabled={submitting} />
            <h3 className="text-lg font-medium text-gray-900 mb-2 pr-10">당일 광고비 입력</h3>
            <p className="text-sm text-gray-600 mb-4">
              채널별로 입력합니다. <strong className="text-gray-800">숨고</strong>는 받은요청·자동견적·예약확정
              건수만 넣으면 됩니다.
            </p>
            <div className="space-y-4 mb-4">
              {channels.map((c) =>
                isSoomgoChannelName(c.name) ? (
                  <div
                    key={c.id}
                    className="border border-teal-200 rounded-lg p-3 bg-teal-50/40 space-y-2"
                  >
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <label className="@container flex min-w-0 flex-col gap-0.5">
                        <span className="block w-full min-w-0 whitespace-nowrap text-gray-600 [font-size:clamp(0.5625rem,0.2rem+3.6cqi,0.75rem)] leading-tight">
                          받은요청 (건당 {SOOMGO_WON_PER_RECEIVED_REQUEST.toLocaleString('ko-KR')}원)
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                          placeholder="0"
                          value={soomgoForm[c.id]?.received ?? ''}
                          onChange={(e) =>
                            setSoomgoForm((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...(prev[c.id] ?? { received: '', autoEstimate: '', confirmed: '' }),
                                received: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="@container flex min-w-0 flex-col gap-0.5">
                        <span className="block w-full min-w-0 whitespace-nowrap text-gray-600 [font-size:clamp(0.5625rem,0.2rem+3.6cqi,0.75rem)] leading-tight">
                          자동견적 (건당 {SOOMGO_WON_PER_AUTO_ESTIMATE.toLocaleString('ko-KR')}원)
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                          placeholder="0"
                          value={soomgoForm[c.id]?.autoEstimate ?? ''}
                          onChange={(e) =>
                            setSoomgoForm((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...(prev[c.id] ?? { received: '', autoEstimate: '', confirmed: '' }),
                                autoEstimate: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="@container flex min-w-0 flex-col gap-0.5">
                        <span className="block w-full min-w-0 whitespace-nowrap text-gray-600 [font-size:clamp(0.5625rem,0.2rem+3.6cqi,0.75rem)] leading-tight">
                          예약확정 (건수)
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="px-2 py-1 border border-gray-300 rounded text-right tabular-nums"
                          placeholder="0"
                          value={soomgoForm[c.id]?.confirmed ?? ''}
                          onChange={(e) =>
                            setSoomgoForm((prev) => ({
                              ...prev,
                              [c.id]: {
                                ...(prev[c.id] ?? { received: '', autoEstimate: '', confirmed: '' }),
                                confirmed: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                    {(() => {
                      const p = soomgoPreview(c);
                      if (p.received === 0 && p.autoEstimate === 0) {
                        return (
                          <p className="text-fluid-xs text-gray-500">받은요청·자동견적 중 하나 이상 입력 시 산출됩니다.</p>
                        );
                      }
                      return (
                        <div className="text-fluid-xs sm:text-sm text-gray-800 space-y-1 border-t border-teal-200/80 pt-2">
                          <p>
                            <span className="text-gray-600">당일 광고비 합계:</span>{' '}
                            <strong className="tabular-nums text-teal-900">{won(p.totalAd)}</strong>
                          </p>
                          <p>
                            <span className="text-gray-600">예약확정 1건당 평균 소모 광고비:</span>{' '}
                            <strong className="tabular-nums text-teal-900">
                              {p.avgPerConfirmed != null ? won(Math.round(p.avgPerConfirmed)) : '— (예약확정 0건)'}
                            </strong>
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div key={c.id} className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-gray-800">{c.name}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                      placeholder="0"
                      value={amounts[c.id] ?? ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                    <span className="text-xs text-gray-500">원</span>
                  </div>
                )
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                취소
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void handleEnd()}
                disabled={submitting}
              >
                {submitting ? '처리 중…' : '종료 및 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
