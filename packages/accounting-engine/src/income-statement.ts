import { TrialBalanceRow } from "./types";
import { round2 } from "./trial-balance";

export interface IncomeStatementLine {
  label: string;
  amount: number;
}

export interface IncomeStatement {
  ventesMarchandises: number;
  achatsMarchandises: number;
  variationStocksMarchandises: number;
  margeCommerciale: number;

  productionAutre: number; // 706/707 : services vendus, produits accessoires
  subventionsExploitation: number; // 71
  achatsConsommes: number; // 602 : matières et fournitures
  servicesExterieurs: number; // 61+62+63
  valeurAjoutee: number;

  chargesPersonnel: number; // 661+664
  impotsEtTaxes: number; // 64
  excedentBrutExploitation: number;

  autresProduits: number; // 75+78+79
  autresCharges: number; // 65
  dotationsAmortissements: number; // 68+69
  resultatExploitation: number;

  produitsFinanciers: number; // 77
  chargesFinancieres: number; // 67
  resultatFinancier: number;

  resultatActivitesOrdinaires: number;

  produitsHAO: number; // 82+84
  chargesHAO: number; // 81+83
  resultatHAO: number;

  participationTravailleurs: number; // 87
  impotsSurResultat: number; // 89
  resultatNet: number;

  /** Same figures, flattened in cascade order — convenient for a report table/PDF. */
  lines: IncomeStatementLine[];
}

function byPrefix(...prefixes: string[]) {
  return (row: TrialBalanceRow) => prefixes.some((p) => row.accountCode.startsWith(p));
}

/** Net amount in the account's "natural" direction: revenue accounts read credit-positive, expense accounts debit-positive. */
function net(rows: TrialBalanceRow[], predicate: (row: TrialBalanceRow) => boolean, direction: "CREDIT" | "DEBIT"): number {
  const matched = rows.filter(predicate);
  const debit = matched.reduce((sum, r) => sum + r.totalDebit, 0);
  const credit = matched.reduce((sum, r) => sum + r.totalCredit, 0);
  return round2(direction === "CREDIT" ? credit - debit : debit - credit);
}

/**
 * Compte de Résultat SYSCOHADA — cascade des Soldes Intermédiaires de Gestion
 * (SIG) : Marge commerciale -> Valeur Ajoutée -> EBE -> Résultat
 * d'Exploitation -> Résultat Financier -> RAO -> Résultat HAO -> Résultat Net.
 * Operates on a trial balance already scoped to the fiscal period.
 */
export function computeIncomeStatement(trialBalance: TrialBalanceRow[]): IncomeStatement {
  const ventesMarchandises = net(trialBalance, byPrefix("701"), "CREDIT");
  const achatsMarchandises = net(trialBalance, byPrefix("601"), "DEBIT");
  const variationStocksMarchandises = net(trialBalance, byPrefix("6031"), "DEBIT");
  const margeCommerciale = round2(ventesMarchandises - achatsMarchandises - variationStocksMarchandises);

  const productionAutre = net(trialBalance, byPrefix("706", "707"), "CREDIT");
  const subventionsExploitation = net(trialBalance, byPrefix("71"), "CREDIT");
  const achatsConsommes = net(trialBalance, byPrefix("602"), "DEBIT");
  const servicesExterieurs = net(trialBalance, byPrefix("61", "62", "63"), "DEBIT");
  const valeurAjoutee = round2(
    margeCommerciale + productionAutre + subventionsExploitation - achatsConsommes - servicesExterieurs,
  );

  const chargesPersonnel = net(trialBalance, byPrefix("661", "664"), "DEBIT");
  const impotsEtTaxes = net(trialBalance, byPrefix("64"), "DEBIT");
  const excedentBrutExploitation = round2(valeurAjoutee - chargesPersonnel - impotsEtTaxes);

  const autresProduits = net(trialBalance, byPrefix("75", "78", "79"), "CREDIT");
  const autresCharges = net(trialBalance, byPrefix("65"), "DEBIT");
  const dotationsAmortissements = net(trialBalance, byPrefix("68", "69"), "DEBIT");
  const resultatExploitation = round2(excedentBrutExploitation + autresProduits - autresCharges - dotationsAmortissements);

  const produitsFinanciers = net(trialBalance, byPrefix("77"), "CREDIT");
  const chargesFinancieres = net(trialBalance, byPrefix("67"), "DEBIT");
  const resultatFinancier = round2(produitsFinanciers - chargesFinancieres);

  const resultatActivitesOrdinaires = round2(resultatExploitation + resultatFinancier);

  const produitsHAO = net(trialBalance, byPrefix("82", "84"), "CREDIT");
  const chargesHAO = net(trialBalance, byPrefix("81", "83"), "DEBIT");
  const resultatHAO = round2(produitsHAO - chargesHAO);

  const participationTravailleurs = net(trialBalance, byPrefix("87"), "DEBIT");
  const impotsSurResultat = net(trialBalance, byPrefix("89"), "DEBIT");
  const resultatNet = round2(resultatActivitesOrdinaires + resultatHAO - participationTravailleurs - impotsSurResultat);

  const statement: IncomeStatement = {
    ventesMarchandises,
    achatsMarchandises,
    variationStocksMarchandises,
    margeCommerciale,
    productionAutre,
    subventionsExploitation,
    achatsConsommes,
    servicesExterieurs,
    valeurAjoutee,
    chargesPersonnel,
    impotsEtTaxes,
    excedentBrutExploitation,
    autresProduits,
    autresCharges,
    dotationsAmortissements,
    resultatExploitation,
    produitsFinanciers,
    chargesFinancieres,
    resultatFinancier,
    resultatActivitesOrdinaires,
    produitsHAO,
    chargesHAO,
    resultatHAO,
    participationTravailleurs,
    impotsSurResultat,
    resultatNet,
    lines: [],
  };

  statement.lines = [
    { label: "Ventes de marchandises", amount: ventesMarchandises },
    { label: "Achats de marchandises", amount: -achatsMarchandises },
    { label: "Variation de stocks de marchandises", amount: -variationStocksMarchandises },
    { label: "MARGE COMMERCIALE", amount: margeCommerciale },
    { label: "Production (services vendus, produits accessoires)", amount: productionAutre },
    { label: "Subventions d'exploitation", amount: subventionsExploitation },
    { label: "Achats consommés", amount: -achatsConsommes },
    { label: "Services extérieurs", amount: -servicesExterieurs },
    { label: "VALEUR AJOUTÉE", amount: valeurAjoutee },
    { label: "Charges de personnel", amount: -chargesPersonnel },
    { label: "Impôts et taxes", amount: -impotsEtTaxes },
    { label: "EXCÉDENT BRUT D'EXPLOITATION", amount: excedentBrutExploitation },
    { label: "Autres produits", amount: autresProduits },
    { label: "Autres charges", amount: -autresCharges },
    { label: "Dotations aux amortissements et provisions", amount: -dotationsAmortissements },
    { label: "RÉSULTAT D'EXPLOITATION", amount: resultatExploitation },
    { label: "Revenus financiers", amount: produitsFinanciers },
    { label: "Frais financiers", amount: -chargesFinancieres },
    { label: "RÉSULTAT FINANCIER", amount: resultatFinancier },
    { label: "RÉSULTAT DES ACTIVITÉS ORDINAIRES (RAO)", amount: resultatActivitesOrdinaires },
    { label: "Produits HAO", amount: produitsHAO },
    { label: "Charges HAO", amount: -chargesHAO },
    { label: "RÉSULTAT HAO", amount: resultatHAO },
    { label: "Participation des travailleurs", amount: -participationTravailleurs },
    { label: "Impôts sur le résultat", amount: -impotsSurResultat },
    { label: "RÉSULTAT NET", amount: resultatNet },
  ];

  return statement;
}
