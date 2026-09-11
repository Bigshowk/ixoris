import { LedgerAccount } from "./types";

/**
 * Practical subset of the plan comptable SYSCOHADA révisé — enough to run a
 * trading company's day-to-day (POS sales, purchases, payroll postings,
 * bank/cash) and produce a coherent Bilan/Compte de Résultat. Not the full
 * exhaustive norm (which runs to hundreds of sub-accounts): companies can add
 * their own accounts under the same class/type conventions via the `Account`
 * table — this list only seeds sensible defaults.
 *
 * Account codes and SIG groupings below follow the standard OHADA structure;
 * treat this as a strong starting point to review with an accountant before
 * relying on it for statutory filings.
 */
export const SYSCOHADA_CHART_OF_ACCOUNTS: LedgerAccount[] = [
  // --- Classe 1 : Comptes de ressources durables ---------------------------------
  { code: "101", label: "Capital social", class: 1, type: "EQUITY" },
  { code: "106", label: "Réserves", class: 1, type: "EQUITY" },
  { code: "110", label: "Report à nouveau", class: 1, type: "EQUITY" },
  { code: "120", label: "Résultat net de l'exercice (bénéfice)", class: 1, type: "EQUITY" },
  { code: "129", label: "Résultat net de l'exercice (perte)", class: 1, type: "EQUITY" },
  { code: "162", label: "Emprunts auprès des établissements de crédit", class: 1, type: "LIABILITY" },

  // --- Classe 2 : Actif immobilisé -------------------------------------------------
  { code: "231", label: "Bâtiments", class: 2, type: "ASSET" },
  { code: "244", label: "Matériel et outillage", class: 2, type: "ASSET" },
  { code: "245", label: "Matériel de transport", class: 2, type: "ASSET" },
  { code: "2831", label: "Amortissements des bâtiments", class: 2, type: "ASSET" },
  { code: "2844", label: "Amortissements du matériel et outillage", class: 2, type: "ASSET" },
  { code: "2845", label: "Amortissements du matériel de transport", class: 2, type: "ASSET" },

  // --- Classe 3 : Stocks ------------------------------------------------------------
  { code: "311", label: "Marchandises", class: 3, type: "ASSET" },
  { code: "320", label: "Matières premières", class: 3, type: "ASSET" },

  // --- Classe 4 : Tiers ---------------------------------------------------------------
  { code: "401", label: "Fournisseurs", class: 4, type: "LIABILITY", isAuxiliary: true },
  { code: "408", label: "Fournisseurs, factures non parvenues", class: 4, type: "LIABILITY" },
  { code: "411", label: "Clients", class: 4, type: "ASSET", isAuxiliary: true },
  { code: "419", label: "Clients créditeurs (avances reçues)", class: 4, type: "LIABILITY" },
  { code: "421", label: "Personnel, avances et acomptes", class: 4, type: "ASSET" },
  { code: "422", label: "Personnel, rémunérations dues", class: 4, type: "LIABILITY" },
  { code: "431", label: "Sécurité sociale (CNPS)", class: 4, type: "LIABILITY" },
  { code: "4431", label: "État, TVA facturée (collectée)", class: 4, type: "LIABILITY" },
  { code: "4452", label: "État, TVA récupérable sur achats", class: 4, type: "ASSET" },
  { code: "447", label: "État, autres impôts et taxes", class: 4, type: "LIABILITY" },
  { code: "471", label: "Débiteurs divers", class: 4, type: "ASSET" },
  { code: "472", label: "Créditeurs divers", class: 4, type: "LIABILITY" },

  // --- Classe 5 : Trésorerie -------------------------------------------------------
  { code: "521", label: "Banques locales", class: 5, type: "ASSET" },
  { code: "571", label: "Caisse", class: 5, type: "ASSET" },

  // --- Classe 6 : Charges ------------------------------------------------------------
  { code: "601", label: "Achats de marchandises", class: 6, type: "EXPENSE" },
  { code: "602", label: "Achats de matières premières", class: 6, type: "EXPENSE" },
  { code: "6031", label: "Variation de stocks de marchandises", class: 6, type: "EXPENSE" },
  { code: "61", label: "Transports", class: 6, type: "EXPENSE" },
  { code: "62", label: "Services extérieurs A (loyers, entretien, assurances)", class: 6, type: "EXPENSE" },
  { code: "63", label: "Services extérieurs B (honoraires, publicité)", class: 6, type: "EXPENSE" },
  { code: "64", label: "Impôts et taxes", class: 6, type: "EXPENSE" },
  { code: "65", label: "Autres charges", class: 6, type: "EXPENSE" },
  { code: "661", label: "Appointements, salaires et commissions", class: 6, type: "EXPENSE" },
  { code: "664", label: "Charges sociales", class: 6, type: "EXPENSE" },
  { code: "671", label: "Intérêts des emprunts", class: 6, type: "EXPENSE" },
  { code: "681", label: "Dotations aux amortissements", class: 6, type: "EXPENSE" },

  // --- Classe 7 : Produits ----------------------------------------------------------
  { code: "701", label: "Ventes de marchandises", class: 7, type: "REVENUE" },
  { code: "706", label: "Services vendus", class: 7, type: "REVENUE" },
  { code: "707", label: "Produits accessoires", class: 7, type: "REVENUE" },
  { code: "71", label: "Subventions d'exploitation", class: 7, type: "REVENUE" },
  { code: "75", label: "Autres produits", class: 7, type: "REVENUE" },
  { code: "77", label: "Revenus financiers", class: 7, type: "REVENUE" },
  { code: "78", label: "Transferts de charges", class: 7, type: "REVENUE" },
  { code: "79", label: "Reprises de provisions", class: 7, type: "REVENUE" },

  // --- Classe 8 : Autres charges et produits (HAO) -----------------------------------
  { code: "81", label: "Valeurs comptables des cessions d'immobilisations", class: 8, type: "EXPENSE" },
  { code: "82", label: "Produits des cessions d'immobilisations", class: 8, type: "REVENUE" },
  { code: "83", label: "Charges HAO", class: 8, type: "EXPENSE" },
  { code: "84", label: "Produits HAO", class: 8, type: "REVENUE" },
  { code: "87", label: "Participation des travailleurs", class: 8, type: "EXPENSE" },
  { code: "89", label: "Impôts sur le résultat", class: 8, type: "EXPENSE" },
];

/** Codes referenced directly by the POS auto-posting and SIG logic — keep in sync with the chart above. */
export const WELL_KNOWN_ACCOUNTS = {
  ventesMarchandises: "701",
  tvaCollectee: "4431",
  tvaRecuperable: "4452",
  clients: "411",
  fournisseurs: "401",
  banque: "521",
  caisse: "571",
  achatsMarchandises: "601",
  variationStocksMarchandises: "6031",
  chargesPersonnel: "661",
  chargesSocialesPersonnel: "664",
  personnelRemunerationsDues: "422",
  securiteSociale: "431",
  etatAutresImpotsTaxes: "447",
  impotsEtTaxes: "64",
  autresCharges: "65",
  autresProduits: "75",
  produitsAccessoires: "707",
  fraisFinanciers: "671",
  revenusFinanciers: "77",
  dotationsAmortissements: "681",
  resultatBenefice: "120",
  resultatPerte: "129",
} as const;
