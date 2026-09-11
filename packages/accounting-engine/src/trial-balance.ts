import { LedgerAccount, LedgerLine, TrialBalanceRow } from "./types";

/**
 * Balance générale : for every account that moved, sum débit/crédit across
 * all posted lines and derive the solde (débiteur si débit > crédit, sinon
 * créditeur). Accounts with zero net balance are still listed at zero, so a
 * trial balance stays a complete audit trail, not just the "live" accounts.
 */
export function computeTrialBalance(accounts: LedgerAccount[], lines: LedgerLine[]): TrialBalanceRow[] {
  const totals = new Map<string, { debit: number; credit: number }>();

  for (const line of lines) {
    const current = totals.get(line.accountCode) ?? { debit: 0, credit: 0 };
    current.debit += line.debit;
    current.credit += line.credit;
    totals.set(line.accountCode, current);
  }

  const rows: TrialBalanceRow[] = [];
  for (const account of accounts) {
    const totalsForAccount = totals.get(account.code);
    if (!totalsForAccount) continue; // only report accounts with actual movements

    const net = round2(totalsForAccount.debit - totalsForAccount.credit);
    rows.push({
      accountCode: account.code,
      label: account.label,
      class: account.class,
      totalDebit: round2(totalsForAccount.debit),
      totalCredit: round2(totalsForAccount.credit),
      balance: Math.abs(net),
      balanceSide: net >= 0 ? "DEBIT" : "CREDIT",
    });
  }

  return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
