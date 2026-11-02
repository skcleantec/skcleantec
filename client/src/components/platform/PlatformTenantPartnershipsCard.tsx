import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { confirmDialog, toast } from '../ui/Toast';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  listPlatformTenantPartnerships,
  platformResumeTenantPartnership,
  platformSuspendTenantPartnership,
  type PlatformTenantPartnershipItem,
} from '../../api/platformTenantPartnerships';
import { CARD_SECTION } from '../../utils/platformUi';

const STATUS_LABEL: Record<PlatformTenantPartnershipItem['status'], string> = {
  PENDING: '승인 대기',
  ACTIVE: '연결됨',
  SUSPENDED: '중지',
  REJECTED: '거절됨',
};

export function PlatformTenantPartnershipsCard({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<PlatformTenantPartnershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    void listPlatformTenantPartnerships(token)
      .then((rows) =>
        setItems(rows.filter((row) => row.tenantLow.id === tenantId || row.tenantHigh.id === tenantId)),
      )
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : '파트너 연결을 불러오지 못했습니다.');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (row: PlatformTenantPartnershipItem, kind: 'suspend' | 'resume') => {
    const token = getPlatformToken();
    if (!token) return;
    const partner = row.tenantLow.id === tenantId ? row.tenantHigh : row.tenantLow;
    const resume = kind === 'resume';
    const ok = await confirmDialog({
      title: resume ? `${partner.name} 연결을 재개할까요?` : `${partner.name} 연결을 중지할까요?`,
      body: resume
        ? '중지가 풀리고 잠시 멈춘 접수 연계가 다시 이어집니다.'
        : '이 업체 연결이 중지되고, 주고받는 접수도 잠시 멈춥니다.',
      confirmLabel: resume ? '재개' : '중지',
      danger: !resume,
    });
    if (!ok) return;
    setActionId(row.id);
    try {
      if (resume) await platformResumeTenantPartnership(token, row.id);
      else await platformSuspendTenantPartnership(token, row.id);
      toast.success(resume ? '파트너 연결을 재개했습니다.' : '파트너 연결을 중지했습니다.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '처리에 실패했습니다.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className={CARD_SECTION}>
      <h2 className="text-fluid-base font-semibold text-slate-900">파트너 연결</h2>
      {loading ? (
        <p className="text-fluid-sm text-slate-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-fluid-sm text-slate-500">연결된 파트너가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-fluid-sm">
            <thead>
              <tr className="border-b border-slate-200 text-fluid-xs text-slate-500">
                <th className="py-2 pr-3 text-center font-medium">상대 업체</th>
                <th className="py-2 pr-3 text-center font-medium">상태</th>
                <th className="py-2 text-center font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => {
                const partner = row.tenantLow.id === tenantId ? row.tenantHigh : row.tenantLow;
                return (
                  <tr key={row.id}>
                    <td className="py-2 pr-3 text-center text-slate-900">
                      <span className="font-medium">{partner.name}</span>
                      <span className="ml-1 font-mono text-fluid-xs text-slate-500">{partner.slug}</span>
                    </td>
                    <td className="py-2 pr-3 text-center text-slate-700">{STATUS_LABEL[row.status]}</td>
                    <td className="py-2 text-center">
                      {row.status === 'SUSPENDED' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={actionId === row.id}
                          onClick={() => void run(row, 'resume')}
                        >
                          재개
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={actionId === row.id}
                          onClick={() => void run(row, 'suspend')}
                        >
                          중지
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
