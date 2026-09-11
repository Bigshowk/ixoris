import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";

const OPEN_INVOICE_STATUSES = ["VALIDATED", "PARTIALLY_PAID", "OVERDUE"] as const;

/**
 * Guards the "contrôle du crédit" spec: an outstanding balance above
 * `Customer.creditLimit`, or an invoice critically overdue, auto-blocks the
 * customer (`isBlocked`) — checked by InvoicesService/SalesService before
 * extending further credit, and reversible manually via block()/unblock().
 */
@Injectable()
export class CreditControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getOutstanding(companyId: string, customerId: string): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, customerId, type: "CUSTOMER", status: { in: [...OPEN_INVOICE_STATUSES] } },
      include: { payments: true },
    });
    return invoices.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
      return sum + Math.max(0, toNumber(inv.totalTTC) - paid);
    }, 0);
  }

  async assertNotBlocked(companyId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    if (customer.isBlocked) {
      throw new BadRequestException(`Le client ${customer.name} est bloqué${customer.blockedReason ? ` : ${customer.blockedReason}` : ""}`);
    }
  }

  /** Re-evaluates a customer's outstanding balance against their credit limit, blocking them if now exceeded. */
  async evaluateCreditLimit(companyId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer || customer.isBlocked) return;

    const outstanding = await this.getOutstanding(companyId, customerId);
    const limit = toNumber(customer.creditLimit);
    if (outstanding > limit) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          isBlocked: true,
          blockedReason: `Encours (${outstanding.toFixed(2)}) supérieur à la limite de crédit (${limit.toFixed(2)})`,
          blockedAt: new Date(),
        },
      });
    }
  }

  async block(companyId: string, customerId: string, reason: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    return this.prisma.customer.update({ where: { id: customerId }, data: { isBlocked: true, blockedReason: reason, blockedAt: new Date() } });
  }

  async unblock(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    return this.prisma.customer.update({ where: { id: customerId }, data: { isBlocked: false, blockedReason: null, blockedAt: null } });
  }

  /** Scans customer invoices overdue beyond `criticalDays` and blocks the customer — meant to be triggered on a schedule, like RemindersService.generateOverdueReminders. */
  async runOverdueCheck(companyId: string, criticalDays = 30) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - criticalDays);

    const criticallyOverdue = await this.prisma.invoice.findMany({
      where: { companyId, type: "CUSTOMER", status: { in: [...OPEN_INVOICE_STATUSES] }, dueDate: { lt: threshold }, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    });

    let blocked = 0;
    for (const { customerId } of criticallyOverdue) {
      if (!customerId) continue;
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer || customer.isBlocked) continue;
      const reason = `Retard de paiement critique (> ${criticalDays} jours)`;
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { isBlocked: true, blockedReason: reason, blockedAt: new Date() },
      });
      await this.prisma.notification.create({
        data: {
          companyId,
          type: "INVOICE_OVERDUE",
          severity: "CRITICAL",
          title: `Client bloqué pour impayés : ${customer.name}`,
          message: `"${customer.name}" a été bloqué automatiquement : ${reason.toLowerCase()}.`,
        },
      });
      blocked++;
    }

    return { checked: criticallyOverdue.length, blocked };
  }
}
