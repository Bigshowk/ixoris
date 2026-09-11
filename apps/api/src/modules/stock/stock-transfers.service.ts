import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { CreateStockTransferDto } from "./dto/stock-transfer.dto";

const transferInclude = { fromWarehouse: true, toWarehouse: true, lines: { include: { product: true } } } as const;

/**
 * A transfer decrements the source warehouse (TRANSFER_OUT) as soon as it's
 * created — the stock is considered "in transit", no longer sellable from
 * the source — and only credits the destination (TRANSFER_IN) once received,
 * mirroring how GoodsReceiptsService handles supplier deliveries.
 */
@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateStockTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Source and destination warehouse must differ");
    }

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          companyId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          status: "IN_TRANSIT",
          lines: { create: dto.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) },
        },
        include: transferInclude,
      });

      for (const line of dto.lines) {
        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: dto.fromWarehouseId } },
        });
        if (!stock || toNumber(stock.quantity) < line.quantity) {
          throw new BadRequestException(`Insufficient stock for product ${line.productId} at source warehouse`);
        }

        const product = await tx.product.findUniqueOrThrow({ where: { id: line.productId } });
        await tx.stock.update({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: dto.fromWarehouseId } },
          data: { quantity: { decrement: line.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: line.productId,
            warehouseId: dto.fromWarehouseId,
            type: "TRANSFER_OUT",
            quantity: line.quantity,
            unitCost: toNumber(product.purchasePrice),
            sourceType: "StockTransfer",
            sourceId: transfer.id,
          },
        });
      }

      return transfer;
    });
  }

  list(companyId: string) {
    return this.prisma.stockTransfer.findMany({ where: { companyId }, include: transferInclude, orderBy: { createdAt: "desc" }, take: 200 });
  }

  async receive(companyId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({ where: { id, companyId }, include: transferInclude });
    if (!transfer) throw new NotFoundException(`Stock transfer ${id} not found`);
    if (transfer.status !== "IN_TRANSIT") throw new BadRequestException(`Stock transfer ${id} is not in transit`);

    await this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        await tx.stock.upsert({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: transfer.toWarehouseId } },
          update: { quantity: { increment: toNumber(line.quantity) } },
          create: { productId: line.productId, warehouseId: transfer.toWarehouseId, quantity: line.quantity },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: line.productId,
            warehouseId: transfer.toWarehouseId,
            type: "TRANSFER_IN",
            quantity: line.quantity,
            unitCost: toNumber(line.product.purchasePrice),
            sourceType: "StockTransfer",
            sourceId: transfer.id,
          },
        });
      }
      await tx.stockTransfer.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date() } });
    });

    return this.prisma.stockTransfer.findFirstOrThrow({ where: { id }, include: transferInclude });
  }
}
