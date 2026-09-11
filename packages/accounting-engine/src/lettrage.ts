import { LedgerLine } from "./types";

export interface LettrageMatch {
  lettrageCode: string;
  lineIds: string[];
  amount: number;
}

/**
 * Lettrage automatique : pairs an unlettered debit line with an unlettered
 * credit line of the *exact same amount* on the same auxiliary account (and
 * same third party, when known) — the common case of "this invoice was paid
 * in full". Greedy 1-to-1 exact-amount matching; partial payments or an
 * invoice settled by several installments need manual lettrage (just set
 * `JournalLine.lettrageCode` directly) since that requires judgment calls
 * this heuristic can't safely make on its own.
 */
export function autoMatchLettrage(lines: LedgerLine[], generateCode: () => string = defaultCodeGenerator()): LettrageMatch[] {
  const unlettered = lines.filter((l) => !l.lettrageCode);
  const debits = unlettered.filter((l) => l.debit > 0 && l.credit === 0);
  const credits = unlettered.filter((l) => l.credit > 0 && l.debit === 0);
  const usedCreditIds = new Set<string>();

  const matches: LettrageMatch[] = [];
  for (const debitLine of debits) {
    const candidate = credits.find(
      (creditLine) =>
        !usedCreditIds.has(creditLine.id) &&
        amountsMatch(debitLine.debit, creditLine.credit) &&
        sameThirdParty(debitLine, creditLine),
    );
    if (!candidate) continue;

    usedCreditIds.add(candidate.id);
    matches.push({
      lettrageCode: generateCode(),
      lineIds: [debitLine.id, candidate.id],
      amount: debitLine.debit,
    });
  }

  return matches;
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function sameThirdParty(a: LedgerLine, b: LedgerLine): boolean {
  if (!a.thirdPartyId && !b.thirdPartyId) return true;
  return a.thirdPartyId === b.thirdPartyId;
}

function defaultCodeGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return counter.toString(36).toUpperCase().padStart(3, "A");
  };
}
