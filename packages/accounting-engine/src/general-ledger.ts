import { GeneralLedgerAccount, LedgerAccount, LedgerLine } from "./types";
import { round2 } from "./trial-balance";

/**
 * Grand livre : chronological movements per account with a running solde.
 * Convention matches the trial balance — positive running balance means the
 * account sits débiteur, negative means créditeur.
 */
export function computeGeneralLedger(accounts: LedgerAccount[], lines: LedgerLine[]): GeneralLedgerAccount[] {
  const byAccount = new Map<string, LedgerLine[]>();
  for (const line of lines) {
    const bucket = byAccount.get(line.accountCode) ?? [];
    bucket.push(line);
    byAccount.set(line.accountCode, bucket);
  }

  const ledger: GeneralLedgerAccount[] = [];
  for (const account of accounts) {
    const accountLines = byAccount.get(account.code);
    if (!accountLines || accountLines.length === 0) continue;

    const sorted = [...accountLines].sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = 0;
    const movements = sorted.map((line) => {
      running = round2(running + line.debit - line.credit);
      return {
        entryId: line.entryId,
        date: line.date,
        label: line.label,
        debit: round2(line.debit),
        credit: round2(line.credit),
        runningBalance: running,
      };
    });

    ledger.push({
      accountCode: account.code,
      label: account.label,
      movements,
      closingBalance: Math.abs(running),
      closingSide: running >= 0 ? "DEBIT" : "CREDIT",
    });
  }

  return ledger.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}
