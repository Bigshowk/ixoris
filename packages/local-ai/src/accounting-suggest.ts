// Relative import (not the "@ixoris/accounting-engine" package specifier) on purpose — same reason
// as packages/escpos/src/receipt.ts: this package has no build step, so when it's reached via a
// node_modules symlink (e.g. from apps/api) ts-node's underlying Node type-stripping refuses to
// resolve a second node_modules hop from inside it. A relative sibling-package import has no
// node_modules segment at all, sidestepping that restriction entirely.
import { SYSCOHADA_CHART_OF_ACCOUNTS } from "../../accounting-engine/src/chart-of-accounts";

export interface AccountSuggestion {
  code: string;
  label: string;
  score: number; // 0..1
  matchedKeywords: string[];
}

interface KeywordRule {
  codes: string[];
  keywords: string[];
}

function foldAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Keyword → SYSCOHADA account heuristics for common trading-company expense/
 * receipt descriptions. Intentionally simple and inspectable (a stock manager
 * or accountant can read every rule) rather than a trained classifier — see
 * `retrieval.ts` module docstring for why this project favors explainable,
 * fully-offline heuristics over an opaque model in this deployment target.
 */
const RULES: KeywordRule[] = [
  { codes: ["601"], keywords: ["achat marchandise", "achat de marchandise", "reappro", "reapprovisionnement", "fournisseur marchandise"] },
  { codes: ["602"], keywords: ["matiere premiere", "matieres premieres"] },
  { codes: ["61"], keywords: ["transport", "livraison", "carburant", "essence", "gasoil", "fret", "peage"] },
  { codes: ["62"], keywords: ["loyer", "location", "assurance", "entretien", "reparation", "electricite", "eau", "internet", "telephone"] },
  { codes: ["63"], keywords: ["honoraire", "avocat", "expert comptable", "publicite", "marketing", "annonce", "communication"] },
  { codes: ["64"], keywords: ["impot", "taxe", "patente", "douane", "vignette"] },
  { codes: ["65"], keywords: ["perte", "casse", "vol", "demarque", "amende", "penalite", "don"] },
  { codes: ["661"], keywords: ["salaire", "appointement", "commission personnel", "prime employe"] },
  { codes: ["664"], keywords: ["cnps", "cotisation sociale", "charge sociale"] },
  { codes: ["671"], keywords: ["interet emprunt", "agios", "frais bancaire", "frais financier"] },
  { codes: ["521"], keywords: ["virement", "banque", "cheque"] },
  { codes: ["571"], keywords: ["especes", "caisse", "cash", "billet"] },
  { codes: ["411"], keywords: ["client", "facture client", "vente a credit"] },
  { codes: ["401"], keywords: ["fournisseur", "facture fournisseur"] },
  { codes: ["4431"], keywords: ["tva collectee", "tva facturee"] },
  { codes: ["4452"], keywords: ["tva deductible", "tva recuperable"] },
  { codes: ["681"], keywords: ["amortissement", "dotation"] },
  { codes: ["707"], keywords: ["frais de livraison", "produit accessoire", "commission percue"] },
  { codes: ["701"], keywords: ["vente marchandise", "vente de marchandise", "recette caisse"] },
];

const accountsByCode = new Map(SYSCOHADA_CHART_OF_ACCOUNTS.map((a) => [a.code, a.label]));

/**
 * Suggests plausible SYSCOHADA account codes for a free-text transaction
 * description (e.g. an unclassified expense or a bank-statement label),
 * ranked by keyword-match strength. Purely a suggestion — the accountant
 * always makes the final call; this never posts an entry on its own.
 */
export function suggestAccounts(description: string, limit = 3): AccountSuggestion[] {
  const text = foldAccents(description);
  const scored: AccountSuggestion[] = [];

  for (const rule of RULES) {
    const matched = rule.keywords.filter((kw) => text.includes(foldAccents(kw)));
    if (matched.length === 0) continue;
    const score = Math.min(1, matched.length / rule.keywords.length + 0.3 * matched.length);
    for (const code of rule.codes) {
      const label = accountsByCode.get(code);
      if (!label) continue;
      scored.push({ code, label, score, matchedKeywords: matched });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const deduped: AccountSuggestion[] = [];
  for (const s of scored) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    deduped.push(s);
    if (deduped.length >= limit) break;
  }
  return deduped;
}
