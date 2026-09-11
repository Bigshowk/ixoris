import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { CreateStockAdjustmentDto } from "./dto/stock-adjustment.dto";

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  levels(companyId: string, warehouseId?: string) {
    return this.prisma.stock.findMany({
      where: { warehouse: { companyId }, warehouseId },
      include: { product: true, warehouse: true },
      orderBy: { product: { name: "asc" } },
    });
  }

  movements(companyId: string, productId?: string, warehouseId?: string) {
    return this.prisma.stockMovement.findMany({
      where: { companyId, productId, warehouseId },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /** Manual correction (stock count, breakage, found stock...) — moves the aggregate Stock row and logs a StockMovement. */
  async adjust(companyId: string, userId: string | undefined, dto: CreateStockAdjustmentDto) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, companyId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException(`Warehouse ${dto.warehouseId} not found`);

    const delta = dto.type === "ADJUSTMENT_IN" ? dto.quantity : -dto.quantity;

    await this.prisma.stock.upsert({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
      update: { quantity: { increment: delta } },
      create: { productId: dto.productId, warehouseId: dto.warehouseId, quantity: Math.max(delta, 0) },
    });

    return this.prisma.stockMovement.create({
      data: {
        companyId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        type: dto.type,
        quantity: dto.quantity,
        unitCost: toNumber(product.purchasePrice),
        reference: dto.reference,
        sourceType: "Manual",
        createdById: userId,
      },
      include: { product: true, warehouse: true },
    });
  }
}
