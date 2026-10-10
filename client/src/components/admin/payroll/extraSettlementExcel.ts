import type { ExtraWorkItem } from '../../../api/extraWork';
import {
  UNASSIGNED,
  buildBoard,
  cellAmount,
  dayLabel,
  jobsForLeader,
  type LeaderCol,
} from './ExtraSettlementBoard';

const SUMMARY = ['당일', '마케터', '오버라이딩', '팀장', '회사'] as const;

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellText(value: string) {
  return `<Cell ss:StyleID="wrap"><Data ss:Type="String">${esc(value)}</Data></Cell>`;
}

function cellNumber(value: number) {
  return `<Cell ss:StyleID="num"><Data ss:Type="Number">${Math.round(value)}</Data></Cell>`;
}

function jobLines(item: ExtraWorkItem, leaderId: string) {
  const shared = leaderId !== UNASSIGNED && item.leaderShares.length > 1;
  const tag = item.settlementKind === 'REFUND' ? '환불' : item.settlementKind === 'COMPANY_SUPPORT' ? '지원' : '';
  return [tag, item.marketerName, String(cellAmount(item, leaderId)), `${shared ? '나눠 배정 · ' : ''}${item.workLabel}`]
    .filter(Boolean)
    .join('\n');
}

function monthTitle(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return '추가정산';
  return `${match[1]}년 ${Number(match[2])}월 추가정산`;
}

function sheet(name: string, rows: string[]) {
  return `<Worksheet ss:Name="${esc(name)}"><Table>${rows.join('')}</Table></Worksheet>`;
}

export function buildExtraSettlementWorkbookXml(items: ExtraWorkItem[], month: string, roster: LeaderCol[]) {
  const board = buildBoard(items, month, roster);
  const header = [cellText('날짜'), ...board.leaders.map((leader) => cellText(leader.name)), ...SUMMARY.map((label) => cellText(label))].join('');
  const dayRows = board.days.map((day) => {
    const leaderCells = board.leaders.map((leader) => {
      const jobs = jobsForLeader(day.items, leader.id);
      return cellText(jobs.map((item) => jobLines(item, leader.id)).join('\n'));
    });
    const totals = [day.amount, day.marketer, day.parent, day.leader, day.company].map(cellNumber);
    return `<Row>${cellText(dayLabel(day.day))}${leaderCells.join('')}${totals.join('')}</Row>`;
  });
  const monthLeaderTotals = board.leaders.map((leader) =>
    cellNumber(
      board.days.reduce(
        (sum, day) => sum + jobsForLeader(day.items, leader.id).reduce((inner, item) => inner + cellAmount(item, leader.id), 0),
        0,
      ),
    ),
  );
  const monthTotals = board.days.reduce(
    (sum, day) => ({
      amount: sum.amount + day.amount,
      marketer: sum.marketer + day.marketer,
      parent: sum.parent + day.parent,
      leader: sum.leader + day.leader,
      company: sum.company + day.company,
    }),
    { amount: 0, marketer: 0, parent: 0, leader: 0, company: 0 },
  );
  const footer = `<Row>${cellText('월정산')}${monthLeaderTotals.join('')}${[monthTotals.amount, monthTotals.marketer, monthTotals.parent, monthTotals.leader, monthTotals.company].map(cellNumber).join('')}</Row>`;
  const grid = sheet('추가정산', [
    `<Row>${cellText(monthTitle(month))}</Row>`,
    `<Row>${header}</Row>`,
    ...dayRows,
    footer,
  ]);

  const marketerHeader = ['마케터', '건수', '추가금액', '수령', '오버라이딩'].map(cellText).join('');
  const marketerRows =
    board.marketers.length === 0
      ? [`<Row>${cellText('이 달 추가 시공이 없습니다.')}</Row>`]
      : board.marketers.map(
          (row) =>
            `<Row>${cellText(row.name)}${cellNumber(row.ownCount)}${cellNumber(row.amount)}${cellNumber(row.take)}${cellNumber(row.fromDownline)}</Row>`,
        );
  const marketers = sheet('마케터별', [`<Row>${marketerHeader}</Row>`, ...marketerRows]);

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="wrap"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
<Style ss:ID="num"><NumberFormat ss:Format="#,##0"/></Style>
</Styles>
${grid}
${marketers}
</Workbook>`;
}

export function downloadExtraSettlementExcel(items: ExtraWorkItem[], month: string, roster: LeaderCol[]) {
  const xml = `\uFEFF${buildExtraSettlementWorkbookXml(items, month, roster)}`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `추가정산_${month || '월'}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
