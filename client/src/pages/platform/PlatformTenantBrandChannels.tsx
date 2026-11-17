import { useCallback, useEffect, useState } from 'react';
import {
  disconnectPlatformBrandChannel,
  excludePlatformBrandChannelFee,
  fetchPlatformTenantBrandChannels,
  fetchRemoteKakaoChannels,
  linkPlatformBrandChannel,
  openPlatformChannelAdmin,
  openPlatformTemplateReview,
  type PlatformTenantBrandRow,
} from '../../api/alimtalkBrandChannel';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION } from '../../utils/platformUi';

export function PlatformTenantBrandChannels({ tenantId }: { tenantId: string }) {
  const [brands, setBrands] = useState<PlatformTenantBrandRow[]>([]);
  const [error, setError] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [linkBrand, setLinkBrand] = useState<PlatformTenantBrandRow | null>(null);
  const [channels, setChannels] = useState<{ channelId: string; channelName: string; usedBy: string | null; platformDefault?: boolean }[]>([]);
  const [picked, setPicked] = useState('');
  const [notice, setNotice] = useState('');
  const [createTemplates, setCreateTemplates] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchPlatformTenantBrandChannels(tenantId);
    setBrands(data.brands);
  }, [tenantId]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '채널을 불러오지 못했습니다.'));
  }, [load]);

  const openLink = async (brand: PlatformTenantBrandRow) => {
    setError('');
    setLinkBrand(brand);
    setCreateTemplates(true);
    try {
      const remote = await fetchRemoteKakaoChannels();
      setChannels(remote.channels);
      setPicked(remote.channels.find((row) => !row.usedBy && !row.platformDefault)?.channelId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '채널 목록을 불러오지 못했습니다.');
    }
  };

  return (
    <section className={`${CARD_SECTION} space-y-3 lg:col-span-2`}>
      <h2 className="text-fluid-sm font-semibold text-gray-900">브랜드별 카카오 채널</h2>
      {error ? <p className="text-fluid-2xs text-red-700">{error}</p> : null}
      {brands.map((brand) => (
        <div key={brand.operatingCompanyId} className="rounded-xl border border-gray-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-fluid-xs font-semibold text-gray-900">{brand.name}</p>
              <p className="text-fluid-2xs text-gray-500">
                {brand.badge.label} · 서식 승인 {brand.approved}/{brand.templateCount}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {brand.channelId ? (
                <button type="button" className={BTN_SECONDARY} onClick={() => void openPlatformTemplateReview().then((r) => window.open(r.url, '_blank', 'noopener,noreferrer'))}>
                  심사 화면 열기
                </button>
              ) : (
                <button type="button" className={BTN_PRIMARY} onClick={() => void openLink(brand)}>
                  채널 연결
                </button>
              )}
              {brand.channelId ? (
                <div className="relative">
                  <button type="button" className={BTN_SECONDARY} onClick={() => setMenuId(menuId === brand.channelId ? null : brand.channelId)}>
                    ···
                  </button>
                  {menuId === brand.channelId ? (
                    <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white p-1 shadow">
                      <button type="button" className="block w-full px-2 py-1.5 text-left text-fluid-2xs" onClick={() => brand.channelId && void disconnectPlatformBrandChannel(tenantId, brand.channelId).then(() => load())}>
                        채널 해제
                      </button>
                      <button type="button" className="block w-full px-2 py-1.5 text-left text-fluid-2xs" onClick={() => brand.channelId && void excludePlatformBrandChannelFee(tenantId, brand.channelId).then(() => load())}>
                        세팅비 청구 제외
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {brand.templates.length > 0 ? (
            <table className="mt-2 w-full text-fluid-2xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="py-1 text-left font-medium">서식</th>
                  <th className="py-1 text-left font-medium">심사</th>
                  <th className="py-1 text-left font-medium">지금 보내는 곳</th>
                  <th className="py-1 text-left font-medium">신청일</th>
                </tr>
              </thead>
              <tbody>
                {brand.templates.map((item) => (
                  <tr key={item.label} className="border-t border-gray-50">
                    <td className="py-1">{item.label}</td>
                    <td className="py-1">
                      {item.statusLabel}
                      {item.status === 'REJECTED' && item.rejectReason ? <p className="text-red-700">{item.rejectReason}</p> : null}
                    </td>
                    <td className="py-1">{item.sendsFrom}</td>
                    <td className="py-1">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ))}

      {linkBrand ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg">
            <h3 className="text-fluid-sm font-semibold text-gray-900">채널 연결</h3>
            <p className="mt-1 text-fluid-2xs text-gray-500">{linkBrand.name}</p>
            <select className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm" value={picked} onChange={(e) => setPicked(e.target.value)}>
              {channels.map((row) => (
                <option key={row.channelId} value={row.channelId} disabled={Boolean(row.usedBy) || Boolean(row.platformDefault)}>
                  {row.channelName || row.channelId}
                  {row.platformDefault ? ' · 청소비서 기본 채널' : row.usedBy ? ` · ${row.usedBy}에서 사용 중` : ''}
                </option>
              ))}
            </select>
            <button type="button" className={`${BTN_SECONDARY} mt-2`} onClick={() => void openPlatformChannelAdmin().then((r) => window.open(r.url, '_blank', 'noopener,noreferrer'))}>
              채널 관리
            </button>
            <label className="mt-3 flex items-start gap-2 text-fluid-2xs text-gray-700">
              <input type="checkbox" checked={createTemplates} onChange={(e) => setCreateTemplates(e.target.checked)} />
              연결하면서 서식 3개를 신청 대기로 올리기
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setLinkBrand(null)}>
                닫기
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => {
                  void linkPlatformBrandChannel(tenantId, {
                    operatingCompanyId: linkBrand.operatingCompanyId,
                    providerChannelId: picked,
                    createTemplates,
                  })
                    .then(() => {
                      setLinkBrand(null);
                      return load();
                    })
                    .catch((err) => {
                      const message = err instanceof Error ? err.message : '연결하지 못했습니다.';
                      if (message.includes('청소비서 기본 채널')) setNotice(message);
                      else setError(message);
                    });
                }}
              >
                연결
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-center shadow-lg">
            <p className="text-fluid-sm font-semibold text-gray-900">{notice}</p>
            <button type="button" className={`${BTN_PRIMARY} mt-3`} onClick={() => setNotice('')}>
              확인
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
