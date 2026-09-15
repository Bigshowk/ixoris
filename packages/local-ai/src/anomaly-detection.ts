export type StockMovementKind = "PURCHASE_IN" | "SALE_OUT" | "TRANSFER_OUT" | "TRANSFER_IN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "RETURN_IN" | "RETURN_OUT";

const INCREASING_TYPES = new Set<StockMovementKind>(["PURCHASE_IN", "TRANSFER_IN", "ADJUSTMENT_IN", "RETURN_IN"]);

export interface StockMovementSample {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  type: StockMovementKind;
  quantity: number; // always the unsigned magnitude, per StockMovement.quantity
  reference: string | null;
  createdAt: Date;
}

export type StockAnomalyKind = "NEGATIVE_STOCK" | "OUTLIER_QUANTITY" | "UNSOURCED_ADJUSTMENT" | "RAPID_REPEATED_ADJUSTMENTS";
export type StockAnomalySeverity = "LOW" | "MEDIUM" | "HIGH";

export interface StockAnomaly {
  kind: StockAnomalyKind;
  severity: StockAnomalySeverity;
  productId: string;
  productName: string;
  warehouseId: string;
  message: string;
  movementIds: string[];
}

export function signedDelta(movement: Pick<StockMovementSample, "type" | "quantity">): number {
  return INCREASING_TYPES.has(movement.type) ? movement.quantity : -movement.quantity;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface DetectAnomaliesOptions {
  /** Minimum prior movements needed for a product before flagging statistical outliers. */
  minHistoryForOutlier?: number;
  /** Z-score threshold above which a movement quantity is flagged as an outlier. */
  outlierZScore?: number;
  /** Window (ms) within which repeated adjustments on the same product are flagged. Default 24h. */
  rapidAdjustmentWindowMs?: number;
  /** Minimum number of adjustments inside the window to flag. Default 3. */
  rapidAdjustmentCount?: number;
}

const DEFAULTS: Required<DetectAnomaliesOptions> = {
  minHistoryForOutlier: 5,
  outlierZScore: 3,
  rapidAdjustmentWindowMs: 24 * 60 * 60 * 1000,
  rapidAdjustmentCount: 3,
};

/**
 * Deterministic, explainable anomaly detection over a company's recent stock
 * movements — no ML model, purely statistical/rule-based (z-score outliers,
 * negative on-hand, undocumented manual adjustments, repeated corrections in
 * a short window). This is the "Assistant Financier & Stock" building block:
 * every finding carries a plain-language rationale so a stock manager can
 * verify it rather than trust a black box.
 */
export function detectStockAnomalies(
  movements: StockMovementSample[],
  currentStockByProductWarehouse: Map<string, number>,
  options?: DetectAnomaliesOptions,
): StockAnomaly[] {
  const opts = { ...DEFAULTS, ...options };
  const anomalies: StockAnomaly[] = [];

  // 1. Negative on-hand stock.
  for (const [key, qty] of currentStockByProductWarehouse) {
    if (qty < 0) {
      const [productId, warehouseId] = key.split("::");
      const sample = movements.find((m) => m.productId === productId && m.warehouseId === warehouseId);
      anomalies.push({
        kind: "NEGATIVE_STOCK",
        severity: "HIGH",
        productId,
        warehouseId,
        productName: sample?.productName ?? productId,
        message: `Stock négatif détecté (${qty}) — une vente ou un transfert a probablement été enregistré sans qu'un mouvement d'entrée correspondant n'ait été comptabilisé.`,
        movementIds: [],
      });
    }
  }

  // Group by product+warehouse for the remaining rules.
  const byProduct = new Map<string, StockMovementSample[]>();
  for (const m of movements) {
    const key = `${m.productId}::${m.warehouseId}`;
    const list = byProduct.get(key) ?? [];
    list.push(m);
    byProduct.set(key, list);
  }

  for (const [, list] of byProduct) {
    const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // 2. Statistical outlier quantity (z-score vs this product's own recent history).
    if (sorted.length >= opts.minHistoryForOutlier) {
      const quantities = sorted.map((m) => m.quantity);
      for (let i = 0; i < sorted.length; i++) {
        const history = quantities.filter((_, idx) => idx !== i);
        if (history.length < opts.minHistoryForOutlier - 1) continue;
        const avg = mean(history);
        const sd = stddev(history, avg);
        if (sd === 0) continue;
        const z = (sorted[i].quantity - avg) / sd;
        if (z > opts.outlierZScore) {
          anomalies.push({
            kind: "OUTLIER_QUANTITY",
            severity: "MEDIUM",
            productId: sorted[i].productId,
            warehouseId: sorted[i].warehouseId,
            productName: sorted[i].productName,
            message: `Mouvement de ${sorted[i].quantity} unités très supérieur à l'habitude pour ce produit (moyenne ${avg.toFixed(1)}, écart-type ${sd.toFixed(1)}) — à vérifier avant validation.`,
            movementIds: [sorted[i].id],
          });
        }
      }
    }

    // 3. Undocumented manual adjustments.
    const undocumented = sorted.filter((m) => (m.type === "ADJUSTMENT_IN" || m.type === "ADJUSTMENT_OUT") && !m.reference?.trim());
    if (undocumented.length > 0) {
      anomalies.push({
        kind: "UNSOURCED_ADJUSTMENT",
        severity: "LOW",
        productId: undocumented[0].productId,
        warehouseId: undocumented[0].warehouseId,
        productName: undocumented[0].productName,
        message: `${undocumented.length} ajustement(s) manuel(s) sans référence/motif renseigné — recommandé pour la piste d'audit.`,
        movementIds: undocumented.map((m) => m.id),
      });
    }

    // 4. Rapid repeated adjustments in a short window.
    const adjustments = sorted.filter((m) => m.type === "ADJUSTMENT_IN" || m.type === "ADJUSTMENT_OUT");
    for (let i = 0; i < adjustments.length; i++) {
      const windowEnd = adjustments[i].createdAt.getTime() + opts.rapidAdjustmentWindowMs;
      const windowGroup = adjustments.filter((m, idx) => idx >= i && m.createdAt.getTime() <= windowEnd);
      if (windowGroup.length >= opts.rapidAdjustmentCount) {
        anomalies.push({
          kind: "RAPID_REPEATED_ADJUSTMENTS",
          severity: "MEDIUM",
          productId: windowGroup[0].productId,
          warehouseId: windowGroup[0].warehouseId,
          productName: windowGroup[0].productName,
          message: `${windowGroup.length} ajustements manuels sur ce produit en moins de 24h — possible démarque inconnue récurrente ou erreur de comptage à investiguer plutôt qu'à corriger en boucle.`,
          movementIds: windowGroup.map((m) => m.id),
        });
        break; // one flag per product is enough, avoid duplicate overlapping windows
      }
    }
  }

  return anomalies;
}
