export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type BalanceSide = "DEBIT" | "CREDIT";

export interface LedgerAccount {
  code: string;
  label: string;
  class: AccountClass;
  type: AccountType;
  /** Client/fournisseur-style account that can be lettered (411, 401...). */
  isAuxiliary?: boolean;
}

/** A single posted journal line, flattened for the engine — framework-agnostic, no Prisma Decimal. */
export interface LedgerLine {
  id: string;
  entryId: string;
  accountCode: string;
  date: Date;
  debit: number;
  credit: number;
  label?: string;
  lettrageCode?: string | null;
  /** Distinguishes rows belonging to the same auxiliary account but different third parties (client/fournisseur id). */
  thirdPartyId?: string | null;
}

export interface TrialBalanceRow {
  accountCode: string;
  label: string;
  class: AccountClass;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  balanceSide: BalanceSide;
}

export interface GeneralLedgerMovement {
  entryId: string;
  date: Date;
  label?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerAccount {
  accountCode: string;
  label: string;
  movements: GeneralLedgerMovement[];
  closingBalance: number;
  closingSide: BalanceSide;
}
