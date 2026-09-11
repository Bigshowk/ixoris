import { round2 } from "./trial-balance";

export interface JournalTotalsInput {
  journalCode: string;
  journalLabel: string;
  debit: number;
  credit: number;
}

export interface JournalSummaryRow {
  journalCode: string;
  journalLabel: string;
  totalDebit: number;
  totalCredit: number;
}

/**
 * Journal centralisateur : total débit/crédit par journal (VE, AC, BQ, CA,
 * OD, PA) sur la période. Callers pre-aggregate per-entry totals (usually via
 * a DB group-by) and pass them in here for the final rounding/shaping pass.
 */
export function computeJournalSummary(rows: JournalTotalsInput[]): JournalSummaryRow[] {
  return rows
    .map((r) => ({
      journalCode: r.journalCode,
      journalLabel: r.journalLabel,
      totalDebit: round2(r.debit),
      totalCredit: round2(r.credit),
    }))
    .sort((a, b) => a.journalCode.localeCompare(b.journalCode));
}
