import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, StockMovementType } from "@ixoris/database";
import { toNumber } from "./pos.mappers";

type Tx = Prisma.TransactionClient;

export interface DeductStockInput {
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reference: string;
  sourceType: string;
  sourceId: string;
  createdById: string;
}

@Injectable()
export class StockService {
  /**
   * Deducts `quantity` of a product from a warehouse for a sale, honoring the
   * company's valuation method:
   *  - FIFO (or any lot-tracked product): consumes StockLot rows oldest-received
   *    first, each generating its own StockMovement at that lot's cost.
   *  - CUMP: decrements the aggregate Stock row using the product's weighted
   *    average cost (Product.purchasePrice) as a single movement.
   * Must run inside the same Prisma transaction as the Sale it belongs to.
   */
  async deductStock(tx: Tx, input: DeductStockInput): Promise<void> {
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } });
    const company = await tx.company.findUniqueOrThrow({ where: { id: input.companyId } });

    const useLots = product.trackLots || company.stockValuationMethod === "FIFO";

    if (useLots) {
      await this.deductViaLots(tx, input);
    } else {
      await this.deductAggregateOnly(tx, input, toNumber(product.purchasePrice));
    }

    // Aggregate Stock row is always the fast-read cache of on-hand quantity.
    await tx.stock.update({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
      data: { quantity: { decrement: input.quantity } },
    });
  }

  private async deductViaLots(tx: Tx, input: DeductStockInput): Promise<void> {
    const lots = await tx.stockLot.findMany({
      where: { productId: input.productId, warehouseId: input.warehouseId, quantity: { gt: 0 } },
      orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
    });

    let remaining = input.quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const lotQty = toNumber(lot.quantity);
      const take = Math.min(lotQty, remaining);

      await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: { decrement: take } } });
      await tx.stockMovement.create({
        data: {
          companyId: input.companyId,
          productId: input.productId,
          warehouseId: input.warehouseId,
          lotId: lot.id,
          type: StockMovementType.SALE_OUT,
          quantity: take,
          unitCost: lot.unitCost,
          reference: input.reference,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          createdById: input.createdById,
        },
      });
      remaining -= take;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient lot stock for product ${input.productId}: missing ${remaining} unit(s)`,
      );
    }
  }

  private async deductAggregateOnly(tx: Tx, input: DeductStockInput, unitCost: number): Promise<void> {
    const stock = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
    });
    if (!stock || toNumber(stock.quantity) < input.quantity) {
      throw new BadRequestException(`Insufficient stock for product ${input.productId}`);
    }

    await tx.stockMovement.create({
      data: {
        companyId: input.companyId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: StockMovementType.SALE_OUT,
        quantity: input.quantity,
        unitCost,
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdById: input.createdById,
      },
    });
  }
}
