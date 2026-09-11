import { Inject, Injectable } from "@nestjs/common";
import { Reminder } from "@ixoris/database";
import { t, formatCurrency, Locale } from "@ixoris/i18n";
import { PrismaService } from "../../prisma/prisma.service";
import { NOTIFICATION_SENDER, NotificationSender } from "./notification-sender";
import { toNumber } from "../pos/pos.mappers";

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  /** Scans overdue customer invoices and schedules one EMAIL reminder each (skips invoices that already have one pending). */
  async generateOverdueReminders(companyId: string) {
    const now = new Date();
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: "CUSTOMER",
        OR: [{ status: "OVERDUE" }, { status: { in: ["VALIDATED", "PARTIALLY_PAID"] }, dueDate: { lt: now } }],
      },
    });

    const created: Reminder[] = [];
    for (const invoice of overdueInvoices) {
      const existing = await this.prisma.reminder.findFirst({
        where: { companyId, targetType: "Invoice", targetId: invoice.id, status: "SCHEDULED" },
      });
      if (existing) continue;

      created.push(
        await this.prisma.reminder.create({
          data: { companyId, type: "PAYMENT_OVERDUE", targetType: "Invoice", targetId: invoice.id, channel: "EMAIL", scheduledAt: now, status: "SCHEDULED" },
        }),
      );
    }

    return { generated: created.length, reminders: created };
  }

  /** Sends every reminder whose scheduledAt has come due, via the configured NotificationSender. */
  async dispatchPending(companyId: string) {
    const now = new Date();
    const pending = await this.prisma.reminder.findMany({ where: { companyId, status: "SCHEDULED", scheduledAt: { lte: now } } });

    let sent = 0;
    let failed = 0;
    for (const reminder of pending) {
      try {
        const { recipient, message } = await this.resolveTarget(reminder);
        await this.sender.send({ channel: reminder.channel, recipient, message });
        await this.prisma.reminder.update({ where: { id: reminder.id }, data: { status: "SENT", sentAt: new Date() } });
        sent++;
      } catch {
        await this.prisma.reminder.update({ where: { id: reminder.id }, data: { status: "FAILED" } });
        failed++;
      }
    }

    return { sent, failed, total: pending.length };
  }

  list(companyId: string) {
    return this.prisma.reminder.findMany({ where: { companyId }, orderBy: { scheduledAt: "desc" }, take: 200 });
  }

  private async resolveTarget(reminder: Reminder): Promise<{ recipient: string; message: string }> {
    if (reminder.targetType !== "Invoice") {
      throw new Error(`Unsupported reminder targetType "${reminder.targetType}"`);
    }

    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: reminder.targetId }, include: { customer: true } });
    const recipient = reminder.channel === "EMAIL" ? invoice.customer?.email : invoice.customer?.phone;
    if (!recipient) {
      throw new Error(`No ${reminder.channel} contact on file for customer of invoice ${invoice.number}`);
    }

    // Bilingual per Customer.preferredLanguage — the reminder reaches them in the language they asked for.
    const locale: Locale = invoice.customer?.preferredLanguage === "en" ? "en" : "fr";
    const message = t(locale, "reminder.overdueInvoice", {
      number: invoice.number,
      amount: formatCurrency(toNumber(invoice.totalTTC), invoice.currencyCode, locale),
    });

    return { recipient, message };
  }
}
