import { Injectable, Logger } from "@nestjs/common";
import { CashMovement, CashSession, CashTransfer } from "@ixoris/database";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { JournalEntriesService, AutoPostLine } from "../accounting/journal-entries.service";
import { toNumber } from "../pos/pos.mappers";

/**
 * Posts the three treasury-driven accounting events: a cash movement (dépense/
 * approvisionnement sur petite caisse ou coffre), a completed inter-account
 * transfer, and the écart de caisse found when a Z de caisse is closed.
 * Best-effort like the other *PostingService classes — never blocks the
 * underlying treasury operation.
 */
@Injectable()
export class TreasuryPostingService {
  private readonly logger = new Logger(TreasuryPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  async postCashMovement(companyId: string, userId: string | undefined, movement: CashMovement, cashBoxAccountCode: string, counterAccountCode: string): Promise<void> {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "CA" } });
      if (!journal) {
        this.logger.warn(`No 'CA' journal configured for company ${companyId} — cash movement ${movement.id} not posted`);
        return;
      }

      const amount = toNumber(movement.amount);
      const label = movement.notes ?? `Mouvement de caisse ${movement.type}`;
      const isInflow = movement.type === "DEPOSIT" || movement.type === "ADJUSTMENT";
      const lines: AutoPostLine[] = isInflow
        ? [
            { accountCode: cashBoxAccountCode, debit: amount, credit: 0, label },
            { accountCode: counterAccountCode, debit: 0, credit: amount, label },
          ]
        : [
            { accountCode: counterAccountCode, debit: amount, credit: 0, label },
            { accountCode: cashBoxAccountCode, debit: 0, credit: amount, label },
          ];

      const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: movement.createdAt,
        description: label,
        sourceType: "CashMovement",
        sourceId: movement.id,
        lines,
      });

      await this.prisma.cashMovement.update({ where: { id: movement.id }, data: { journalEntryId: entry.id } });
    } catch (err) {
      this.logger.warn(`Failed to auto-post cash movement ${movement.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async postCashTransfer(companyId: string, userId: string | undefined, transfer: CashTransfer, fromAccountCode: string, toAccountCode: string): Promise<void> {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "OD" } });
      if (!journal) {
        this.logger.warn(`No 'OD' journal configured for company ${companyId} — transfer ${transfer.id} not posted`);
        return;
      }

      const amount = toNumber(transfer.amount);
      const label = transfer.reference ?? `Transfert de fonds`;
      const lines: AutoPostLine[] = [
        { accountCode: toAccountCode, debit: amount, credit: 0, label },
        { accountCode: fromAccountCode, debit: 0, credit: amount, label },
      ];

      const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: new Date(),
        description: label,
        sourceType: "CashTransfer",
        sourceId: transfer.id,
        lines,
      });

      await this.prisma.cashTransfer.update({ where: { id: transfer.id }, data: { journalEntryId: entry.id, status: "COMPLETED", completedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Failed to auto-post cash transfer ${transfer.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Books the écart de caisse (compté - attendu) at Z-de-caisse closing against 65 (manquant) or 75 (excédent). */
  async postSessionVariance(companyId: string, userId: string | undefined, session: CashSession, registerAccountCode: string): Promise<void> {
    try {
      const expected = toNumber(session.expectedBalance);
      const closing = toNumber(session.closingBalance);
      const variance = round2(closing - expected);
      if (Math.abs(variance) < 0.01) return;

      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "CA" } });
      if (!journal) {
        this.logger.warn(`No 'CA' journal configured for company ${companyId} — cash session ${session.id} variance not posted`);
        return;
      }

      const label = `Écart de caisse — session ${session.id}`;
      const counterAccountCode = variance < 0 ? WELL_KNOWN_ACCOUNTS.autresCharges : WELL_KNOWN_ACCOUNTS.autresProduits;
      const amount = Math.abs(variance);
      const lines: AutoPostLine[] =
        variance < 0
          ? [
              { accountCode: counterAccountCode, debit: amount, credit: 0, label },
              { accountCode: registerAccountCode, debit: 0, credit: amount, label },
            ]
          : [
              { accountCode: registerAccountCode, debit: amount, credit: 0, label },
              { accountCode: counterAccountCode, debit: 0, credit: amount, label },
            ];

      const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: session.closedAt ?? new Date(),
        description: label,
        sourceType: "CashSession",
        sourceId: session.id,
        lines,
      });

      await this.prisma.cashSession.update({ where: { id: session.id }, data: { journalEntryId: entry.id } });
    } catch (err) {
      this.logger.warn(`Failed to auto-post cash session variance for ${session.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
