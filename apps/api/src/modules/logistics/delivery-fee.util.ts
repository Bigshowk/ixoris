import { DeliveryZone } from "@ixoris/database";
import { toNumber } from "../pos/pos.mappers";

export interface DeliveryFeeInput {
  zone: Pick<DeliveryZone, "feeFlat" | "feePerKm" | "feePerKg"> | null;
  weightKg?: number;
  distanceKm?: number;
}

/** Frais de port = forfait de zone + (poids × tarif/kg) + (distance × tarif/km) — chaque terme n'agit que si la zone le définit. */
export function computeDeliveryFee({ zone, weightKg, distanceKm }: DeliveryFeeInput): number {
  if (!zone) return 0;

  let fee = toNumber(zone.feeFlat ?? 0);
  if (zone.feePerKg && weightKg) fee += toNumber(zone.feePerKg) * weightKg;
  if (zone.feePerKm && distanceKm) fee += toNumber(zone.feePerKm) * distanceKm;

  return Math.round((fee + Number.EPSILON) * 100) / 100;
}
