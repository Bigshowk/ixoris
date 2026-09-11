export interface StatementLineInput {
  id: string;
  date: Date;
  /** Positive = credit (money in), negative = debit (money out) — matches how banks present a relevé. */
  amount: number;
  label?: string;
}

export interface JournalLineForReconciliation {
  id: string;
  date: Date;
  debit: number;
  credit: number;
}

export interface ReconciliationMatch {
  statementLineId: string;
  journalLineId: string;
  amount: number;
}

/**
 * Rapprochement bancaire : pairs each statement line with the internal
 * journal line (posted to the bank's GL account) of the same amount within
 * a date window. A statement credit (money in) matches a journal line that
 * *debited* the bank account; a statement debit matches one that *credited*
 * it — mirrors how the GL account itself moves. Exact-amount matching only,
 * same rationale as auto-lettrage: ambiguous partial matches need a human.
 */
export function matchBankStatement(
  statementLines: StatementLineInput[],
  journalLines: JournalLineForReconciliation[],
  dateToleranceDays = 5,
): ReconciliationMatch[] {
  const usedJournalLineIds = new Set<string>();
  const matches: ReconciliationMatch[] = [];

  for (const statementLine of statementLines) {
    const isCredit = statementLine.amount > 0;
    const absAmount = Math.abs(statementLine.amount);

    const candidate = journalLines.find((journalLine) => {
      if (usedJournalLineIds.has(journalLine.id)) return false;
      const relevantAmount = isCredit ? journalLine.debit : journalLine.credit;
      if (Math.abs(relevantAmount - absAmount) >= 0.01) return false;
      const dayDiff = Math.abs((journalLine.date.getTime() - statementLine.date.getTime()) / 86_400_000);
      return dayDiff <= dateToleranceDays;
    });

    if (candidate) {
      usedJournalLineIds.add(candidate.id);
      matches.push({ statementLineId: statementLine.id, journalLineId: candidate.id, amount: absAmount });
    }
  }

  return matches;
}

export interface ParsedStatementLine {
  date: Date;
  label: string;
  amount: number;
}

/**
 * Parses a bank statement CSV: `date;label;amount` (semicolon-separated,
 * ISO dates, one header row). Matches the same pragmatic "generic local
 * bank export" choice made for the payroll bank-transfer CSV — most banks'
 * downloadable relevés fit this shape closely enough to adapt.
 */
export function parseBankStatementCsv(csv: string): ParsedStatementLine[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const [, ...rows] = lines; // skip header
  return rows.map((row, index) => {
    const columns = row.split(";").map((c) => c.trim());
    if (columns.length < 3) {
      throw new Error(`Bank statement CSV row ${index + 2} is malformed (expected "date;label;amount"): "${row}"`);
    }
    const [dateStr, label, amountStr] = columns;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) throw new Error(`Bank statement CSV row ${index + 2} has an invalid date: "${dateStr}"`);
    const amount = Number(amountStr.replace(",", "."));
    if (Number.isNaN(amount)) throw new Error(`Bank statement CSV row ${index + 2} has an invalid amount: "${amountStr}"`);

    return { date, label, amount };
  });
}
