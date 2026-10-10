import { useEffect, useMemo, useState } from 'react';
import { fetchExtraWorkList, type ExtraWorkItem } from '../../../api/extraWork';
import { getTeamLeaders } from '../../../api/users';
import { useCrmInquiryEdit } from '../../../hooks/useCrmInquiryEdit';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { ExtraSettlementBoard, kstDayKey, type DaySumKind } from './ExtraSettlementBoard';
import { ExtraSettlementAdjustSheet } from './ExtraSettlementAdjustSheet';
import { ExtraSettlementDayBreakdown } from './ExtraSettlementDayBreakdown';
import { ExtraSettlementSettings } from './ExtraSettlementSettings';
import { downloadExtraSettlementExcel } from './extraSettlementExcel';

function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function ExtraSettlementTab(props: { token: string; month: string }) {
  const { token, month } = props;
  const [items, setItems] = useState<ExtraWorkItem[]>([]);
  const [leaders, setLeaders] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [adjustItem, setAdjustItem] = useState<ExtraWorkItem | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [sumView, setSumView] = useState<{ day: string; kind: DaySumKind } | null>(null);

  const load = () => {
    if (!token || !month) return;
    void fetchExtraWorkList(token, { month })
      .then((rows) => {
        setItems(rows);
        setError('');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '추가정산을 불러오지 못했습니다.');
      });
  };

  const inquiryEdit = useCrmInquiryEdit(Boolean(token), load, load);

  useEffect(() => {
    load();
  }, [month, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void getTeamLeaders(token)
      .then((rows) => {
        if (!cancelled) setLeaders(rows.map((row) => ({ id: row.id, name: row.name })));
      })
      .catch(() => {
        if (!cancelled) setLeaders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const overrideEarned = useMemo(() => {
    const earned: Record<string, number> = {};
    for (const item of items) {
      if (!item.parentMarketerId || item.parentWon <= 0) continue;
      earned[item.parentMarketerId] = (earned[item.parentMarketerId] ?? 0) + item.parentWon;
    }
    return earned;
  }, [items]);

  const totals = useMemo(
    () =>
      items.reduce(
        (sum, item) => ({
          amount: sum.amount + item.amountWon,
          marketer: sum.marketer + item.marketerWon,
          parent: sum.parent + item.parentWon,
          leader: sum.leader + item.teamLeaderWon,
          company: sum.company + item.companyWon,
        }),
        { amount: 0, marketer: 0, parent: 0, leader: 0, company: 0 },
      ),
    [items],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-xs text-slate-600">
          추가금액 {won(totals.amount)} · 마케터 {won(totals.marketer)} · 오버라이딩 {won(totals.parent)} · 팀장 {won(totals.leader)} · 회사 {won(totals.company)}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => downloadExtraSettlementExcel(items, month, leaders)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <LineMdIcon name="download" className="size-4" />
            엑셀
          </button>
          <button
            type="button"
            onClick={() => {
              setAdjustItem(null);
              setShowAdjust(true);
            }}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            환불·지원
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            설정
          </button>
        </div>
      </div>
      <ExtraSettlementSettings
        token={token}
        open={showSettings}
        onClose={() => setShowSettings(false)}
        earnedById={overrideEarned}
      />
      <ExtraSettlementAdjustSheet
        token={token}
        month={month}
        open={showAdjust}
        item={adjustItem}
        leaders={leaders}
        onClose={() => setShowAdjust(false)}
        onSaved={load}
      />
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <ExtraSettlementDayBreakdown
        open={sumView != null}
        day={sumView?.day ?? ''}
        kind={sumView?.kind ?? 'amount'}
        items={sumView ? items.filter((item) => kstDayKey(item.occurredAt) === sumView.day) : []}
        onClose={() => setSumView(null)}
        onOpenInquiry={inquiryEdit.openInquiryEdit}
      />
      {inquiryEdit.layer}
      <ExtraSettlementBoard
        items={items}
        month={month}
        leaders={leaders}
        onEdit={(item) => {
          setAdjustItem(item);
          setShowAdjust(true);
        }}
        onOpenSum={(day, kind) => setSumView({ day, kind })}
      />
    </div>
  );
}
