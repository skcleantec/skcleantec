import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getVolumeStats, type VolumeStats } from '../../api/adminDiagnostics';

const btnCls =
  'rounded px-2 py-1 text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50';

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right font-medium ${highlight ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

export function AdminVolumeStatsButton({ adminToken }: { adminToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VolumeStats | null>(null);

  async function load() {
    if (!adminToken) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const d = await getVolumeStats(adminToken);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '볼륨 상태를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className={btnCls} onClick={load} title="앱 볼륨 용량·파일수 상태 확인">
        볼륨 상태
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">앱 볼륨 상태</h3>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => setOpen(false)}
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                {loading ? <p className="text-sm text-gray-500">불러오는 중…</p> : null}
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {data && !loading ? (
                  <div className="space-y-2 text-sm text-gray-700">
                    <Row label="마운트 경로" value={data.mountPath} />
                    {data.bytes ? (
                      <Row
                        label="용량 사용률"
                        value={`${data.bytes.usedPct}%  (${data.bytes.usedHuman} / ${data.bytes.totalHuman})`}
                        highlight={data.bytes.usedPct >= 90}
                      />
                    ) : (
                      <Row label="용량" value={data.statfsError || '확인 불가'} />
                    )}
                    {data.inodes ? (
                      <Row
                        label="파일수(inode) 사용률"
                        value={`${data.inodes.usedPct}%  (${data.inodes.used.toLocaleString()} / ${data.inodes.total.toLocaleString()})`}
                        highlight={data.inodes.usedPct >= 90}
                      />
                    ) : null}
                    <Row
                      label="C/S 사진 개수"
                      value={
                        data.csFileCount == null
                          ? data.csReadError || '확인 불가'
                          : data.csFileCount.toLocaleString()
                      }
                    />
                    <p className="pt-2 text-xs text-gray-500">
                      용량은 낮은데 파일수(inode)가 90%↑이면 “파일이 너무 많아서 full”이 원인입니다.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
