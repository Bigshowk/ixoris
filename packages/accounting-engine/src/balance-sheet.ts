import { LedgerAccount, TrialBalanceRow } from "./types";
import { round2 } from "./trial-balance";

export interface BalanceSheetLine {
  label: string;
  amount: number;
}

export interface BalanceSheet {
  actifImmobilise: number;
  actifCirculant: number;
  tresorerieActif: number;
  totalActif: number;

  ressourcesDurables: number; // capitaux propres + dettes financières + résultat de l'exercice
  passifCirculant: number;
  tresoreriePassif: number;
  totalPassif: number;

  /** Sanity check: totalActif should equal totalPassif by construction. */
  balanced: boolean;
  difference: number;

  actifLines: BalanceSheetLine[];
  passifLines: BalanceSheetLine[];
}

function netByClass(trialBalance: TrialBalanceRow[], accountsByCode: Map<string, LedgerAccount>, klass: number, direction: "DEBIT" | "CREDIT", type?: LedgerAccount["type"]) {
  const matched = trialBalance.filter((row) => {
    if (row.class !== klass) return false;
    if (!type) return true;
    return accountsByCode.get(row.accountCode)?.type === type;
  });
  const debit = matched.reduce((sum, r) => sum + r.totalDebit, 0);
  const credit = matched.reduce((sum, r) => sum + r.totalCredit, 0);
  return round2(direction === "DEBIT" ? debit - credit : credit - debit);
}

/**
 * Bilan SYSCOHADA — calculé comme une "situation intermédiaire" : les
 * comptes de charges/produits (classes 6-8) ne sont pas repris directement
 * (ils ne se clôturent formellement dans le compte 12x qu'en fin
 * d'exercice) ; le résultat net de la période, déjà calculé par
 * `computeIncomeStatement`, est injecté dans les Ressources Durables pour
 * que le bilan reste équilibré à tout moment de l'exercice.
 */
export function computeBalanceSheet(
  accounts: LedgerAccount[],
  trialBalance: TrialBalanceRow[],
  resultatNetExercice: number,
): BalanceSheet {
  const accountsByCode = new Map(accounts.map((a) => [a.code, a]));

  const actifImmobilise = netByClass(trialBalance, accountsByCode, 2, "DEBIT");
  const actifCirculant = round2(
    netByClass(trialBalance, accountsByCode, 3, "DEBIT") + netByClass(trialBalance, accountsByCode, 4, "DEBIT", "ASSET"),
  );
  const tresorerieActif = netByClass(trialBalance, accountsByCode, 5, "DEBIT", "ASSET");
  const totalActif = round2(actifImmobilise + actifCirculant + tresorerieActif);

  const ressourcesDurables = round2(netByClass(trialBalance, accountsByCode, 1, "CREDIT") + resultatNetExercice);
  const passifCirculant = netByClass(trialBalance, accountsByCode, 4, "CREDIT", "LIABILITY");
  const tresoreriePassif = netByClass(trialBalance, accountsByCode, 5, "CREDIT", "LIABILITY");
  const totalPassif = round2(ressourcesDurables + passifCirculant + tresoreriePassif);

  const difference = round2(totalActif - totalPassif);

  return {
    actifImmobilise,
    actifCirculant,
    tresorerieActif,
    totalActif,
    ressourcesDurables,
    passifCirculant,
    tresoreriePassif,
    totalPassif,
    balanced: Math.abs(difference) < 0.01,
    difference,
    actifLines: [
      { label: "Actif immobilisé", amount: actifImmobilise },
      { label: "Actif circulant (stocks, clients...)", amount: actifCirculant },
      { label: "Trésorerie-Actif (banques, caisse)", amount: tresorerieActif },
      { label: "TOTAL ACTIF", amount: totalActif },
    ],
    passifLines: [
      { label: "Ressources durables (capitaux propres, résultat, emprunts)", amount: ressourcesDurables },
      { label: "Passif circulant (fournisseurs, état, personnel...)", amount: passifCirculant },
      { label: "Trésorerie-Passif (découverts bancaires)", amount: tresoreriePassif },
      { label: "TOTAL PASSIF", amount: totalPassif },
    ],
  };
}
