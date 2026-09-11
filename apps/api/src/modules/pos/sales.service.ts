import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CheckoutInput, SaleDTO } from "@ixoris/types";
import { mapSale, toNumber } from "./pos.mappers";
import { StockService } from "./stock.service";
import { PosGateway } from "../realtime/pos.gateway";
import { ProductsService } from "./products.service";
import { SalesPostingService } from "../accounting/sales-posting.service";
import { CreditControlService } from "../credit-control/credit-control.service";

const saleInclude = { items: { include: { product: true } }, payments: true } as const;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly gateway: PosGateway,
    private readonly products: ProductsService,
    private readonly accountingPosting: SalesPostingService,
    private readonly creditControl: CreditControlService,
  ) {}

  async checkout(companyId: string, cashierId: string, input: CheckoutInput): Promise<SaleDTO> {
    const cart = await this.prisma.cart.findFirst({
      where: { id: input.cartId, companyId },
      include: { items: { include: { product: true } } },
    });
    if (!cart) throw new NotFoundException(`Cart ${input.cartId} not found`);
    if (cart.status !== "ACTIVE") throw new BadRequestException(`Cart ${input.cartId} is no longer active`);
    if (cart.items.length === 0) throw new BadRequestException("Cannot checkout an empty cart");

    if (cart.customerId && input.payments.some((p) => p.method === "CREDIT")) {
      await this.creditControl.assertNotBlocked(companyId, cart.customerId);
    }

    const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);

    const lineTotals = cart.items.map((item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);
      const discount = toNumber(item.discount);
      const tvaRate = toNumber(item.product.tvaRate);
      const lineSubtotal = quantity * unitPrice - discount;
      const lineTva = lineSubtotal * (tvaRate / 100);
      return { item, quantity, unitPrice, discount, tvaRate, lineSubtotal, lineTva, total: lineSubtotal + lineTva };
    });

    const subtotal = round2(lineTotals.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const discountTotal = round2(lineTotals.reduce((s, l) => s + l.discount, 0));
    const tvaTotal = round2(lineTotals.reduce((s, l) => s + l.lineTva, 0));
    const total = round2(lineTotals.reduce((s, l) => s + l.total, 0));

    // Cash tenders may exceed the total (change due); non-cash tenders must not.
    const nonCashOverpaid = input.payments.some((p) => p.method !== "CASH") && totalPaid > total + 0.01;
    if (totalPaid < total - 0.01 || nonCashOverpaid) {
      throw new BadRequestException(`Payments (${totalPaid}) do not cover the sale total (${total})`);
    }

    const warehouseId = await this.products.resolveStoreWarehouseId(cart.storeId);
    const saleNumber = this.generateSaleNumber();

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          companyId,
          storeId: cart.storeId,
          registerId: input.registerId,
          cashSessionId: input.cashSessionId,
          cartId: cart.id,
          customerId: cart.customerId,
          number: saleNumber,
          status: "COMPLETED",
          subtotal,
          discountTotal,
          tvaTotal,
          total,
          createdById: cashierId,
          items: {
            create: lineTotals.map((l) => ({
              productId: l.item.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              tvaRate: l.tvaRate,
              total: round2(l.total),
            })),
          },
          payments: {
            create: input.payments.map((p) => ({
              amount: p.amount,
              method: p.method,
              reference: p.reference,
              receivedById: cashierId,
            })),
          },
        },
        include: saleInclude,
      });

      for (const line of lineTotals) {
        await this.stock.deductStock(tx, {
          companyId,
          productId: line.item.productId,
          warehouseId,
          quantity: line.quantity,
          reference: saleNumber,
          sourceType: "Sale",
          sourceId: created.id,
          createdById: cashierId,
        });
      }

      await tx.cart.update({ where: { id: cart.id }, data: { status: "CONVERTED" } });

      return created;
    });

    await this.accountingPosting.postSale(companyId, sale);

    const dto = mapSale(sale);
    this.gateway.emitSaleCompleted(dto);
    return dto;
  }

  async findOne(companyId: string, saleId: string): Promise<SaleDTO> {
    const sale = await this.prisma.sale.findFirst({ where: { id: saleId, companyId }, include: saleInclude });
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
    return mapSale(sale);
  }

  private generateSaleNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `S${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
