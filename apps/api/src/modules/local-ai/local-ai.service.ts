import { Injectable } from "@nestjs/common";
import { answerHybrid, detectStockAnomalies, getLlmStatus, suggestAccounts, HelpDomain, StockMovementSample } from "@ixoris/local-ai";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";

@Injectable()
export class LocalAiService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hybrid support assistant: generative (local LLM) when one is detected,
   * transparently falling back to the extractive RAG engine otherwise — see
   * packages/local-ai/src/hybrid-assistant.ts.
   */
  ask(question: string, domain?: HelpDomain) {
    return answerHybrid(question, domain);
  }

  /** Backs the "Statut IA" badge in the Aide tab — cheap, cached probe (see getLlmStatus's 30s TTL). */
  status() {
    return getLlmStatus();
  }

  suggestJournalAccounts(description: string) {
    return suggestAccounts(description);
  }

  /** Scans a company's recent stock movements for statistical/rule-based anomalies — see packages/local-ai/src/anomaly-detection.ts. */
  async stockAnomalies(companyId: string, warehouseId?: string) {
    const [movements, stockRows] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { companyId, warehouseId },
        include: { product: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.prisma.stock.findMany({
        where: { warehouse: { companyId }, warehouseId },
      }),
    ]);

    const samples: StockMovementSample[] = movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product.name,
      warehouseId: m.warehouseId,
      type: m.type,
      quantity: toNumber(m.quantity),
      reference: m.reference,
      createdAt: m.createdAt,
    }));

    const currentStock = new Map<string, number>();
    for (const row of stockRows) {
      currentStock.set(`${row.productId}::${row.warehouseId}`, toNumber(row.quantity));
    }

    return detectStockAnomalies(samples, currentStock);
  }
}
