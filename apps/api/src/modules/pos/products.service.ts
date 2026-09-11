import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductSummary } from "@ixoris/types";
import { toNumber } from "./pos.mappers";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the warehouse a store's POS sells out of. Every Store must have at least one Warehouse. */
  async resolveStoreWarehouseId(storeId: string): Promise<string> {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { storeId }, select: { id: true } });
    if (!warehouse) {
      throw new NotFoundException(`No warehouse configured for store ${storeId}`);
    }
    return warehouse.id;
  }

  async findByBarcode(companyId: string, storeId: string, barcode: string): Promise<ProductSummary> {
    const barcodeRow = await this.prisma.productBarcode.findUnique({
      where: { barcode },
      include: { product: { include: { unit: true } } },
    });

    if (!barcodeRow || barcodeRow.product.companyId !== companyId || !barcodeRow.product.isActive) {
      throw new NotFoundException(`No active product for barcode ${barcode}`);
    }

    const warehouseId = await this.resolveStoreWarehouseId(storeId);
    const stock = await this.prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: barcodeRow.product.id, warehouseId } },
    });

    return this.toSummary(barcodeRow.product, barcode, stock?.quantity);
  }

  async search(companyId: string, storeId: string, query: string): Promise<ProductSummary[]> {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { unit: true, barcodes: { take: 1 } },
      take: 25,
    });

    const warehouseId = await this.resolveStoreWarehouseId(storeId);
    const productIds = products.map((p) => p.id);
    const stocks = await this.prisma.stock.findMany({ where: { warehouseId, productId: { in: productIds } } });
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s.quantity]));

    return products.map((p) => this.toSummary(p, p.barcodes[0]?.barcode ?? null, stockByProduct.get(p.id)));
  }

  private toSummary(
    product: { id: string; sku: string; name: string; sellingPrice: unknown; tvaRate: unknown; imageUrl: string | null; unit?: { label: string } | null },
    barcode: string | null,
    quantity: unknown,
  ): ProductSummary {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      sellingPrice: toNumber(product.sellingPrice),
      tvaRate: toNumber(product.tvaRate),
      unitLabel: product.unit?.label ?? null,
      imageUrl: product.imageUrl,
      barcode,
      availableQuantity: quantity ? toNumber(quantity) : 0,
    };
  }
}
