import { round2 } from "./trial-balance";

export type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE";

export interface DepreciationScheduleInput {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  method: DepreciationMethod;
  /** Coefficient fiscal OHADA appliqué au taux linéaire (ex. 2 pour 3-4 ans, 2.5 au-delà) — ignoré en linéaire. */
  decliningBalanceRate?: number;
}

export interface DepreciationScheduleRow {
  sequenceNumber: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

/**
 * Plan d'amortissement sur `usefulLifeYears` exercices. Le dégressif applique
 * le taux (linéaire × coefficient fiscal) à la valeur nette comptable
 * restante puis bascule sur le linéaire dès que celui-ci devient supérieur
 * (règle standard OHADA/fiscale) — garantit une valeur nette comptable finale
 * égale à `residualValue` sans dernier exercice négatif ou résiduel.
 */
export function computeDepreciationSchedule(input: DepreciationScheduleInput): DepreciationScheduleRow[] {
  const { acquisitionCost, residualValue, usefulLifeYears, method, decliningBalanceRate } = input;
  const depreciableBase = round2(acquisitionCost - residualValue);
  const rows: DepreciationScheduleRow[] = [];
  let accumulated = 0;

  if (method === "STRAIGHT_LINE") {
    const annual = round2(depreciableBase / usefulLifeYears);
    for (let year = 1; year <= usefulLifeYears; year++) {
      const amount = year === usefulLifeYears ? round2(depreciableBase - accumulated) : annual;
      accumulated = round2(accumulated + amount);
      rows.push({ sequenceNumber: year, depreciationAmount: amount, accumulatedDepreciation: accumulated, netBookValue: round2(acquisitionCost - accumulated) });
    }
    return rows;
  }

  const straightRate = 1 / usefulLifeYears;
  const rate = straightRate * (decliningBalanceRate ?? 2);
  let remainingBase = depreciableBase;

  for (let year = 1; year <= usefulLifeYears; year++) {
    const yearsLeft = usefulLifeYears - year + 1;
    const decliningAmount = round2(remainingBase * rate);
    const straightRemaining = round2(remainingBase / yearsLeft);
    const amount = year === usefulLifeYears ? remainingBase : round2(Math.min(Math.max(decliningAmount, straightRemaining), remainingBase));
    accumulated = round2(accumulated + amount);
    remainingBase = round2(remainingBase - amount);
    rows.push({ sequenceNumber: year, depreciationAmount: amount, accumulatedDepreciation: accumulated, netBookValue: round2(acquisitionCost - accumulated) });
  }
  return rows;
}
