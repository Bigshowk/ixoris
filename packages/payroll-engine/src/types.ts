export type SalaryComponentType = "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
export type CalculationMethod = "FIXED" | "PERCENTAGE" | "FORMULA";

export interface SalaryComponentInput {
  code: string;
  label: string;
  type: SalaryComponentType;
  calculationMethod: CalculationMethod;
  /** Amount (FIXED) or percentage points (PERCENTAGE); ignored for FORMULA, which looks itself up by `code`. */
  rateOrAmount: number;
  isTaxable: boolean;
}

/** One bracket of a progressive scale: taxed at `rate`% for the slice of base up to `upTo` (null = no ceiling, last bracket). */
export interface TaxBracket {
  upTo: number | null;
  rate: number;
}

export interface FormulaContext {
  grossSalary: number;
  taxableBase: number;
}

export type FormulaResolver = (context: FormulaContext) => number;

export interface PayslipLineResult {
  componentCode: string;
  label: string;
  type: SalaryComponentType;
  base: number;
  amount: number;
}

export interface PayslipResult {
  employeeId: string;
  grossSalary: number;
  totalDeductions: number;
  totalEmployerContributions: number;
  netSalary: number;
  lines: PayslipLineResult[];
}

export interface ComputePayslipInput {
  employeeId: string;
  baseSalary: number;
  /** Additional primes/deductions/employer contributions beyond the base salary line, which is always added automatically. */
  components: SalaryComponentInput[];
}
