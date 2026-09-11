import { SalaryComponent } from "@ixoris/database";
import { SalaryComponentInput } from "@ixoris/payroll-engine";
import { toNumber } from "../pos/pos.mappers";

export function mapSalaryComponent(component: SalaryComponent): SalaryComponentInput {
  return {
    code: component.code,
    label: component.label,
    type: component.type,
    calculationMethod: component.calculationMethod,
    rateOrAmount: toNumber(component.rateOrAmount),
    isTaxable: component.isTaxable,
  };
}
