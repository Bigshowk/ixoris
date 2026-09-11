import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { toNumber } from "../pos/pos.mappers";

/** Illustrative threshold (base currency units) above which a customer is auto-classified VIP — tune per business. */
const VIP_SPEND_THRESHOLD = 500_000;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        type: dto.type ?? "INDIVIDUAL",
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        creditLimit: dto.creditLimit ?? 0,
        category: "NEW",
      },
    });
  }

  list(companyId: string) {
    return this.prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, companyId } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return customer;
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(companyId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  /** LTV, order frequency, and overdue exposure — the "Analytique Client" the CRM spec asks for. */
  async analytics(companyId: string, id: string) {
    await this.findOne(companyId, id);

    const [sales, invoices] = await Promise.all([
      this.prisma.sale.findMany({ where: { companyId, customerId: id, status: "COMPLETED" }, select: { total: true, date: true } }),
      this.prisma.invoice.findMany({
        where: { companyId, customerId: id, type: "CUSTOMER" },
        select: { totalTTC: true, status: true, dueDate: true, date: true },
      }),
    ]);

    const billedInvoices = invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
    const now = new Date();
    const overdueInvoices = invoices.filter(
      (i) => i.status === "OVERDUE" || ((i.status === "VALIDATED" || i.status === "PARTIALLY_PAID") && i.dueDate < now),
    );

    const salesTotal = sales.reduce((sum, s) => sum + toNumber(s.total), 0);
    const invoicesTotal = billedInvoices.reduce((sum, i) => sum + toNumber(i.totalTTC), 0);
    const totalSpent = round2(salesTotal + invoicesTotal);

    const orderCount = sales.length + billedInvoices.length;
    const allDates = [...sales.map((s) => s.date), ...billedInvoices.map((i) => i.date)];
    const lastPurchaseDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : null;

    return {
      totalSpent,
      orderCount,
      averageOrderValue: orderCount > 0 ? round2(totalSpent / orderCount) : 0,
      lastPurchaseDate,
      daysSinceLastPurchase: lastPurchaseDate ? Math.floor((now.getTime() - lastPurchaseDate.getTime()) / 86_400_000) : null,
      overdueInvoiceCount: overdueInvoices.length,
      overdueTotal: round2(overdueInvoices.reduce((sum, i) => sum + toNumber(i.totalTTC), 0)),
    };
  }

  /** Re-derives VIP / LATE_PAYER / REGULAR / NEW from actual purchase and payment history. */
  async recomputeCategory(companyId: string, id: string) {
    const analytics = await this.analytics(companyId, id);

    const category =
      analytics.overdueInvoiceCount > 0
        ? "LATE_PAYER"
        : analytics.orderCount === 0
          ? "NEW"
          : analytics.totalSpent >= VIP_SPEND_THRESHOLD
            ? "VIP"
            : "REGULAR";

    return this.prisma.customer.update({ where: { id }, data: { category } });
  }

  async recomputeAllCategories(companyId: string) {
    const customers = await this.prisma.customer.findMany({ where: { companyId }, select: { id: true } });
    const results = [];
    for (const customer of customers) {
      results.push(await this.recomputeCategory(companyId, customer.id));
    }
    return results;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
