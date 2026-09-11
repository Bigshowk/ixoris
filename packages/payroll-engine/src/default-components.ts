import { FormulaResolver, SalaryComponentInput, TaxBracket } from "./types";
import { applyProgressiveBrackets, cappedPercentage } from "./tax-brackets";

/**
 * ⚠️ ILLUSTRATIVE DEFAULTS — NOT TAX ADVICE. These figures approximate the
 * shape of Côte d'Ivoire's ITS (Impôt sur Traitements et Salaires) and CNPS
 * contribution rules so the *mechanism* (progressive brackets, capped
 * percentages) can be exercised end-to-end. Payroll tax law changes and
 * varies by OHADA member state — a company MUST confirm current rates and
 * ceilings with the DGI/CNPS (or an accountant) and update these values
 * before running real payroll. Treat this file as a starting configuration,
 * not a source of truth.
 */
export const SAMPLE_ITS_BRACKETS_CI: TaxBracket[] = [
  { upTo: 75000, rate: 0 },
  { upTo: 240000, rate: 16 },
  { upTo: 800000, rate: 21 },
  { upTo: 2400000, rate: 24 },
  { upTo: 8000000, rate: 28 },
  { upTo: null, rate: 32 },
];

/** Monthly CNPS retirement contribution ceiling (XOF) — illustrative, verify current value. */
export const SAMPLE_CNPS_RETIREMENT_CEILING = 1_647_315;

export const BUILTIN_FORMULAS: Record<string, FormulaResolver> = {
  ITS: (ctx) => applyProgressiveBrackets(ctx.taxableBase, SAMPLE_ITS_BRACKETS_CI),
  CNPS_SALARIE: (ctx) => cappedPercentage(ctx.grossSalary, 6.3, SAMPLE_CNPS_RETIREMENT_CEILING),
  CNPS_RETRAITE_PATRONALE: (ctx) => cappedPercentage(ctx.grossSalary, 7.7, SAMPLE_CNPS_RETIREMENT_CEILING),
};

/** A reasonable starting set of components a company can edit/extend via the `SalaryComponent` table. */
export const DEFAULT_SALARY_COMPONENTS: SalaryComponentInput[] = [
  { code: "PRIME_TRANSPORT", label: "Prime de transport", type: "EARNING", calculationMethod: "FIXED", rateOrAmount: 25000, isTaxable: false },
  { code: "CNPS_SALARIE", label: "CNPS — part salariale (retraite)", type: "DEDUCTION", calculationMethod: "FORMULA", rateOrAmount: 0, isTaxable: false },
  { code: "ITS", label: "Impôt sur Traitements et Salaires (ITS)", type: "DEDUCTION", calculationMethod: "FORMULA", rateOrAmount: 0, isTaxable: false },
  { code: "CNPS_RETRAITE_PATRONALE", label: "CNPS — part patronale (retraite)", type: "EMPLOYER_CONTRIBUTION", calculationMethod: "FORMULA", rateOrAmount: 0, isTaxable: false },
  { code: "CNPS_PRESTATIONS_FAMILIALES", label: "CNPS — prestations familiales (patronal)", type: "EMPLOYER_CONTRIBUTION", calculationMethod: "PERCENTAGE", rateOrAmount: 5.75, isTaxable: false },
  { code: "CNPS_ACCIDENTS_TRAVAIL", label: "CNPS — accidents du travail (patronal)", type: "EMPLOYER_CONTRIBUTION", calculationMethod: "PERCENTAGE", rateOrAmount: 3, isTaxable: false },
];
