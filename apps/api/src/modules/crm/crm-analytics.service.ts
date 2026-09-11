import { Injectable } from "@nestjs/common";
import { CustomerCategory } from "@ixoris/database";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class CrmAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Company-wide "Analytique Client" : segmentation, active customers, retention, top spenders. */
  async companyAnalytics(companyId: string) {
    const customers = await this.prisma.customer.findMany({ where: { companyId }, select: { category: true } });
    const categoryBreakdown: Record<CustomerCategory, number> = { VIP: 0, REGULAR: 0, LATE_PAYER: 0, NEW: 0 };
    for (const c of customers) categoryBreakdown[c.category]++;

    const since90Days = new Date(Date.now() - NINETY_DAYS_MS);
    const recentSales = await this.prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", date: { gte: since90Days }, customerId: { not: null } },
      select: { customerId: true },
    });
    const activeCustomers90d = new Set(recentSales.map((s) => s.customerId)).size;

    const salesByCustomer = await this.prisma.sale.groupBy({
      by: ["customerId"],
      where: { companyId, status: "COMPLETED", customerId: { not: null } },
      _count: { id: true },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
    });

    const customersWithAnyOrder = salesByCustomer.length;
    const repeatCustomers = salesByCustomer.filter((g) => g._count.id > 1).length;
    const retentionRate = customersWithAnyOrder > 0 ? round2((repeatCustomers / customersWithAnyOrder) * 100) : 0;

    const topSpenders = salesByCustomer.slice(0, 5);
    const topCustomerRecords = await this.prisma.customer.findMany({
      where: { id: { in: topSpenders.map((t) => t.customerId).filter((id): id is string => !!id) } },
    });
    const topCustomers = topSpenders.map((t) => ({
      customer: topCustomerRecords.find((c) => c.id === t.customerId) ?? null,
      totalSpent: round2(toNumber(t._sum.total ?? 0)),
      orderCount: t._count.id,
    }));

    return {
      totalCustomers: customers.length,
      categoryBreakdown,
      activeCustomers90d,
      retentionRate,
      topCustomers,
      overdueCustomersCount: categoryBreakdown.LATE_PAYER,
    };
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
