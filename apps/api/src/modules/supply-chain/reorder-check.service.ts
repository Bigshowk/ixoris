import { Injectable } from "@nestjs/common";
import { PurchaseOrderStatus } from "@ixoris/database";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { SupplierQuotesService } from "./supplier-quotes.service";
import { PurchaseOrdersService } from "./purchase-orders.service";

const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "SENT", "PARTIALLY_RECEIVED"];

interface Suggestion {
  productId: string;
  warehouseId: string;
  supplierId: string;
  unitPrice: number;
  tvaRate: number;
  quantity: number;
}

/**
 * Scans on-hand stock against `Product.minStockAlert` and auto-drafts a
 * `PurchaseOrder` per (cheapest supplier, warehouse) group — one call site
 * for the "génération automatique de bons de commande" requirement. A
 * product with no active `SupplierQuote` can't be auto-ordered (nobody to
 * order it from), so it raises a `Notification` instead of a silent no-op.
 * No cron wired yet: call this on-demand or hook a scheduler to it later.
 */
@Injectable()
export class ReorderCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: SupplierQuotesService,
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  async run(companyId: string) {
    const stocks = await this.prisma.stock.findMany({
      where: { product: { companyId, isActive: true } },
      include: { product: true },
    });

    const lowStock = stocks.filter((s) => {
      const threshold = toNumber(s.product.minStockAlert);
      return threshold > 0 && toNumber(s.quantity) <= threshold;
    });

    if (lowStock.length === 0) {
      return { checked: stocks.length, lowStock: 0, ordersCreated: 0, notificationsCreated: 0 };
    }

    const openLines = await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { companyId, status: { in: OPEN_PO_STATUSES } } },
      select: { productId: true },
    });
    const productsWithOpenPO = new Set(openLines.map((l) => l.productId));

    const suggestionsByGroup = new Map<string, Suggestion[]>();
    let notificationsCreated = 0;

    for (const stock of lowStock) {
      if (productsWithOpenPO.has(stock.productId)) continue;

      const quote = await this.quotes.cheapestForProduct(companyId, stock.productId);
      if (!quote) {
        await this.prisma.notification.create({
          data: {
            companyId,
            type: "STOCK_LOW",
            severity: "WARNING",
            title: `Réapprovisionnement sans fournisseur : ${stock.product.name}`,
            message: `"${stock.product.name}" a atteint son seuil de stock (${toNumber(stock.quantity)} <= ${toNumber(stock.product.minStockAlert)}) mais aucune cotation fournisseur active n'est enregistrée pour le commander automatiquement.`,
          },
        });
        notificationsCreated++;
        continue;
      }

      const fallbackQuantity = toNumber(stock.product.minStockAlert) * 2 || 1;
      const quantity = stock.product.reorderQuantity ? toNumber(stock.product.reorderQuantity) : fallbackQuantity;

      const groupKey = `${quote.supplierId}::${stock.warehouseId}`;
      const group = suggestionsByGroup.get(groupKey) ?? [];
      group.push({
        productId: stock.productId,
        warehouseId: stock.warehouseId,
        supplierId: quote.supplierId,
        unitPrice: toNumber(quote.unitPrice),
        tvaRate: toNumber(stock.product.tvaRate),
        quantity,
      });
      suggestionsByGroup.set(groupKey, group);
    }

    let ordersCreated = 0;
    for (const group of suggestionsByGroup.values()) {
      const [first] = group;
      await this.purchaseOrders.create(
        companyId,
        undefined,
        {
          supplierId: first.supplierId,
          warehouseId: first.warehouseId,
          lines: group.map((g) => ({
            productId: g.productId,
            quantityOrdered: g.quantity,
            unitPrice: g.unitPrice,
            tvaRate: g.tvaRate,
          })),
        },
        true,
      );
      ordersCreated++;
    }

    return { checked: stocks.length, lowStock: lowStock.length, ordersCreated, notificationsCreated };
  }
}
