import { attachInspectionSummaryToInquiry } from '../inquiry-inspection/inquiryInspection.summary.js';

type CsReportWithInquiry = {
  inquiry?: { inspectionChecklist?: unknown } | null;
  [key: string]: unknown;
};

export function serializeCsReportRow<T extends CsReportWithInquiry>(row: T) {
  const { inquiry, ...rest } = row;
  if (!inquiry) return { ...rest, inquiry: null };
  return {
    ...rest,
    inquiry: attachInspectionSummaryToInquiry(
      inquiry as Parameters<typeof attachInspectionSummaryToInquiry>[0],
    ),
  };
}

export function serializeCsReportRows<T extends CsReportWithInquiry>(rows: T[]) {
  return rows.map((row) => serializeCsReportRow(row));
}
