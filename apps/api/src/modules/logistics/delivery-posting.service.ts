import { Injectable, Logger } from "@nestjs/common";
import { Delivery } from "@ixoris/database";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { JournalEntriesService, AutoPostLine } from "../accounting/journal-entries.service";
import { toNumber } from "../pos/pos.mappers";

/**
 * Posts the two logistics-driven accounting events the spec calls out:
 *  - Delivery fee revenue on DELIVERED (Débit Caisse / Crédit 707 Produits accessoires) —
 *    assumes cash-on-delivery collection, the common case for this kind of dispatch.
 *  - Stock lost/damaged in transit on FAILED (Débit 65 Autres charges / Crédit 411 Clients) —
 *    Delivery isn't line-item-tracked (no per-product breakdown), so this books the loss as
 *    the company absorbing/writing off the estimated value against the customer's receivable
 *    rather than reversing a specific StockMovement. A fuller model would need delivery lines.
 * Best-effort like the other *PostingService classes — never blocks the delivery workflow.
 */
@Injectable()
export class DeliveryPostingService {
  private readonly logger = new Logger(DeliveryPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  async postDeliveryFee(companyId: string, userId: string, delivery: Delivery): Promise<void> {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "CA" } });
      if (!journal) {
        this.logger.warn(`No 'CA' journal configured for company ${companyId} — delivery ${delivery.number} fee not posted`);
        return;
      }

      const amount = toNumber(delivery.feeAmount);
      if (amount <= 0) return;

      const label = `Frais de livraison ${delivery.number}`;
      const lines: AutoPostLine[] = [
        { accountCode: WELL_KNOWN_ACCOUNTS.caisse, debit: amount, credit: 0, label },
        { accountCode: WELL_KNOWN_ACCOUNTS.produitsAccessoires, debit: 0, credit: amount, label },
      ];

      const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: delivery.deliveredAt ?? new Date(),
        description: label,
        sourceType: "Delivery",
        sourceId: delivery.id,
        lines,
      });

      await this.prisma.delivery.update({ where: { id: delivery.id }, data: { journalEntryId: entry.id } });
    } catch (err) {
      this.logger.warn(`Failed to auto-post delivery fee for ${delivery.number}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async postTransitLoss(companyId: string, userId: string, delivery: Delivery, lostValue: number): Promise<void> {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "OD" } });
      if (!journal) {
        this.logger.warn(`No 'OD' journal configured for company ${companyId} — transit loss for ${delivery.number} not posted`);
        return;
      }

      const clientAccountId = delivery.customerId
        ? (await this.prisma.customer.findUnique({ where: { id: delivery.customerId } }))?.accountId
        : null;
      const clientAccountCode = clientAccountId
        ? (await this.prisma.account.findUnique({ where: { id: clientAccountId } }))?.code
        : undefined;

      const label = `Perte/casse en transit — livraison ${delivery.number}`;
      const lines: AutoPostLine[] = [
        { accountCode: WELL_KNOWN_ACCOUNTS.autresCharges, debit: lostValue, credit: 0, label },
        { accountCode: clientAccountCode ?? WELL_KNOWN_ACCOUNTS.clients, debit: 0, credit: lostValue, label },
      ];

      await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: new Date(),
        description: label,
        sourceType: "Delivery",
        sourceId: delivery.id,
        lines,
      });
    } catch (err) {
      this.logger.warn(`Failed to auto-post transit loss for ${delivery.number}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
