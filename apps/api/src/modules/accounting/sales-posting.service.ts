import { Injectable, Logger } from "@nestjs/common";
import { Payment, PaymentMethod, Sale } from "@ixoris/database";
import { PrismaService } from "../../prisma/prisma.service";
import { JournalEntriesService, AutoPostLine } from "./journal-entries.service";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { toNumber } from "../pos/pos.mappers";

const PAYMENT_ACCOUNT: Record<PaymentMethod, string> = {
  CASH: WELL_KNOWN_ACCOUNTS.caisse,
  CARD: WELL_KNOWN_ACCOUNTS.banque,
  MOBILE_MONEY: WELL_KNOWN_ACCOUNTS.banque,
  BANK_TRANSFER: WELL_KNOWN_ACCOUNTS.banque,
  CHECK: WELL_KNOWN_ACCOUNTS.banque,
  CREDIT: WELL_KNOWN_ACCOUNTS.clients,
};

/**
 * Auto-comptabilisation des ventes POS : chaque vente complétée génère une
 * écriture équilibrée dans le journal des ventes (VE). Best-effort — une
 * société qui n'a pas encore configuré son plan comptable/journal ne doit
 * jamais empêcher l'encaissement en caisse ; l'erreur est journalisée et la
 * vente reste simplement non comptabilisée jusqu'à correction.
 */
@Injectable()
export class SalesPostingService {
  private readonly logger = new Logger(SalesPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  async postSale(companyId: string, sale: Sale & { payments: Payment[] }): Promise<string | null> {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "VE" } });
      if (!journal) {
        this.logger.warn(`No 'VE' journal configured for company ${companyId} — sale ${sale.number} not posted`);
        return null;
      }

      const ht = round2(toNumber(sale.subtotal) - toNumber(sale.discountTotal));
      const tva = round2(toNumber(sale.tvaTotal));
      const ttc = round2(toNumber(sale.total));
      const totalPaid = round2(sale.payments.reduce((sum, p) => sum + toNumber(p.amount), 0));
      let remainingChange = Math.max(0, round2(totalPaid - ttc));

      const debitLines: AutoPostLine[] = [];
      for (const payment of sale.payments) {
        let amount = toNumber(payment.amount);
        if (payment.method === "CASH" && remainingChange > 0) {
          const absorbed = Math.min(remainingChange, amount);
          amount = round2(amount - absorbed);
          remainingChange = round2(remainingChange - absorbed);
        }
        if (amount <= 0) continue;
        debitLines.push({
          accountCode: PAYMENT_ACCOUNT[payment.method],
          debit: amount,
          credit: 0,
          label: `Encaissement ${payment.method} — vente ${sale.number}`,
        });
      }

      const creditLines: AutoPostLine[] = [];
      if (ht > 0) creditLines.push({ accountCode: WELL_KNOWN_ACCOUNTS.ventesMarchandises, debit: 0, credit: ht, label: `Ventes — ${sale.number}` });
      if (tva > 0) creditLines.push({ accountCode: WELL_KNOWN_ACCOUNTS.tvaCollectee, debit: 0, credit: tva, label: `TVA collectée — ${sale.number}` });

      const entry = await this.journalEntries.postBalancedEntry(companyId, sale.createdById, {
        journalId: journal.id,
        date: sale.date,
        description: `Vente ${sale.number}`,
        sourceType: "Sale",
        sourceId: sale.id,
        lines: [...debitLines, ...creditLines],
      });

      await this.prisma.sale.update({ where: { id: sale.id }, data: { journalEntryId: entry.id } });
      return entry.id;
    } catch (err) {
      this.logger.warn(`Failed to auto-post sale ${sale.number}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
