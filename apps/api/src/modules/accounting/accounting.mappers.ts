import { Account, AccountClass, JournalLine } from "@ixoris/database";
import { LedgerAccount, LedgerLine } from "@ixoris/accounting-engine";
import { toNumber } from "../pos/pos.mappers";

const PRISMA_CLASS_TO_NUMBER: Record<AccountClass, LedgerAccount["class"]> = {
  CLASS_1: 1,
  CLASS_2: 2,
  CLASS_3: 3,
  CLASS_4: 4,
  CLASS_5: 5,
  CLASS_6: 6,
  CLASS_7: 7,
  CLASS_8: 8,
  CLASS_9: 9,
};

export function mapAccount(account: Account): LedgerAccount {
  return {
    code: account.code,
    label: account.label,
    class: PRISMA_CLASS_TO_NUMBER[account.class],
    type: account.type,
    isAuxiliary: account.isAuxiliary,
  };
}

type JournalLineWithRelations = JournalLine & {
  account: Account;
  journalEntry: { id: string; date: Date };
};

/**
 * Each Customer/Supplier owns its own dedicated auxiliary Account (see
 * Customer.accountId / Supplier.accountId), the standard OHADA way of
 * keeping per-third-party sub-ledgers — so lettrage scoping by account code
 * already isolates third parties without needing a separate column here.
 */
export function mapJournalLine(line: JournalLineWithRelations): LedgerLine {
  return {
    id: line.id,
    entryId: line.journalEntry.id,
    accountCode: line.account.code,
    date: line.journalEntry.date,
    debit: toNumber(line.debit),
    credit: toNumber(line.credit),
    label: line.label ?? undefined,
    lettrageCode: line.lettrageCode,
  };
}
