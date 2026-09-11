import { TaxBracket } from "./types";

/**
 * Standard marginal/progressive scale calculator: each bracket's rate only
 * applies to the slice of `base` that falls within it (not the whole base),
 * which is how income-tax-style barèmes (ITS, IRPP...) work across the
 * OHADA zone. Country-agnostic — pass whatever bracket table applies.
 */
export function applyProgressiveBrackets(base: number, brackets: TaxBracket[]): number {
  if (base <= 0) return 0;

  let tax = 0;
  let lowerBound = 0;
  for (const bracket of brackets) {
    if (base <= lowerBound) break;
    const upper = bracket.upTo ?? Infinity;
    const sliceWidth = Math.min(base, upper) - lowerBound;
    if (sliceWidth > 0) tax += sliceWidth * (bracket.rate / 100);
    lowerBound = upper;
  }
  return round2(tax);
}

/** Common CNPS-style contribution: a flat percentage of the base, capped at a monthly ceiling. */
export function cappedPercentage(base: number, ratePercent: number, ceiling: number): number {
  return round2(Math.min(base, ceiling) * (ratePercent / 100));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
