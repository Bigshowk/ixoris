import { ComputePayslipInput, FormulaResolver, PayslipLineResult, PayslipResult, SalaryComponentInput } from "./types";
import { round2 } from "./tax-brackets";
import { BUILTIN_FORMULAS } from "./default-components";

const BASE_SALARY_CODE = "BASE";

/**
 * Computes one payslip: base salary + configured earnings first (to get the
 * gross), then deductions and employer contributions evaluated against that
 * gross/taxable base — mirrors how a real bulletin de paie is built top to
 * bottom. `formulas` lets a caller override/extend FORMULA-type components
 * (see BUILTIN_FORMULAS) without touching this function.
 */
export function computePayslip(input: ComputePayslipInput, formulas: Record<string, FormulaResolver> = BUILTIN_FORMULAS): PayslipResult {
  const lines: PayslipLineResult[] = [
    { componentCode: BASE_SALARY_CODE, label: "Salaire de base", type: "EARNING", base: input.baseSalary, amount: round2(input.baseSalary) },
  ];

  let grossSalary = input.baseSalary;
  let taxableGross = input.baseSalary;

  for (const component of input.components.filter((c) => c.type === "EARNING")) {
    const amount = resolveAmount(component, { grossSalary: input.baseSalary, taxableBase: input.baseSalary }, formulas);
    lines.push({ componentCode: component.code, label: component.label, type: "EARNING", base: input.baseSalary, amount });
    grossSalary += amount;
    if (component.isTaxable) taxableGross += amount;
  }
  grossSalary = round2(grossSalary);
  taxableGross = round2(taxableGross);

  let totalDeductions = 0;
  for (const component of input.components.filter((c) => c.type === "DEDUCTION")) {
    const amount = resolveAmount(component, { grossSalary, taxableBase: taxableGross }, formulas);
    lines.push({ componentCode: component.code, label: component.label, type: "DEDUCTION", base: taxableGross, amount });
    totalDeductions += amount;
  }

  let totalEmployerContributions = 0;
  for (const component of input.components.filter((c) => c.type === "EMPLOYER_CONTRIBUTION")) {
    const amount = resolveAmount(component, { grossSalary, taxableBase: taxableGross }, formulas);
    lines.push({ componentCode: component.code, label: component.label, type: "EMPLOYER_CONTRIBUTION", base: grossSalary, amount });
    totalEmployerContributions += amount;
  }

  return {
    employeeId: input.employeeId,
    grossSalary,
    totalDeductions: round2(totalDeductions),
    totalEmployerContributions: round2(totalEmployerContributions),
    netSalary: round2(grossSalary - totalDeductions),
    lines,
  };
}

function resolveAmount(
  component: SalaryComponentInput,
  context: { grossSalary: number; taxableBase: number },
  formulas: Record<string, FormulaResolver>,
): number {
  switch (component.calculationMethod) {
    case "FIXED":
      return round2(component.rateOrAmount);
    case "PERCENTAGE":
      return round2(context.grossSalary * (component.rateOrAmount / 100));
    case "FORMULA": {
      const resolver = formulas[component.code];
      if (!resolver) throw new Error(`No formula resolver registered for salary component "${component.code}"`);
      return round2(resolver(context));
    }
  }
}
