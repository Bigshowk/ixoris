import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { computeDepreciationSchedule, WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { JournalEntriesService, AutoPostLine } from "../accounting/journal-entries.service";
import { toNumber } from "../pos/pos.mappers";

/**
 * Generates the full depreciation plan up front (potentially years ahead of
 * any `FiscalYear` row that exists yet — see the schema comment on
 * `DepreciationEntry`) and posts each line's dotation (681 / compte
 * d'amortissement classe 28) only once its `periodEndDate` is reached and a
 * matching fiscal year/period can actually be resolved.
 */
@Injectable()
export class DepreciationService {
  private readonly logger = new Logger(DepreciationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  async generateSchedule(companyId: string, fixedAssetId: string): Promise<void> {
    const asset = await this.prisma.fixedAsset.findFirst({ where: { id: fixedAssetId, companyId } });
    if (!asset) throw new NotFoundException(`Fixed asset ${fixedAssetId} not found`);

    const rows = computeDepreciationSchedule({
      acquisitionCost: toNumber(asset.acquisitionCost),
      residualValue: toNumber(asset.residualValue),
      usefulLifeYears: asset.usefulLifeYears,
      method: asset.depreciationMethod,
      decliningBalanceRate: asset.decliningBalanceRate ? toNumber(asset.decliningBalanceRate) : undefined,
    });

    await this.prisma.$transaction(
      rows.map((row) => {
        const periodEndDate = new Date(asset.acquisitionDate);
        periodEndDate.setFullYear(periodEndDate.getFullYear() + row.sequenceNumber);

        return this.prisma.depreciationEntry.create({
          data: {
            fixedAssetId,
            sequenceNumber: row.sequenceNumber,
            periodEndDate,
            depreciationAmount: row.depreciationAmount,
            accumulatedDepreciation: row.accumulatedDepreciation,
            netBookValue: row.netBookValue,
          },
        });
      }),
    );
  }

  /** Posts every unposted entry whose periodEndDate has passed and whose fiscal year/period can be resolved — meant as a periodic/manual trigger, like payroll runs. */
  async postDue(companyId: string, userId: string | undefined, asOf: Date = new Date()) {
    const dueEntries = await this.prisma.depreciationEntry.findMany({
      where: { isPosted: false, periodEndDate: { lte: asOf }, fixedAsset: { companyId, status: "IN_SERVICE" } },
      include: { fixedAsset: { include: { assetAccount: true, depreciationAccount: true } } },
      orderBy: { sequenceNumber: "asc" },
    });

    const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "OD" } });
    if (!journal) {
      this.logger.warn(`No 'OD' journal configured for company ${companyId} — depreciation not posted`);
      return { posted: 0, skipped: dueEntries.length };
    }

    let posted = 0;
    let skipped = 0;
    for (const entry of dueEntries) {
      try {
        const label = `Dotation amortissement ${entry.fixedAsset.code} — exercice ${entry.sequenceNumber}`;
        const amount = toNumber(entry.depreciationAmount);
        const lines: AutoPostLine[] = [
          { accountCode: WELL_KNOWN_ACCOUNTS.dotationsAmortissements, debit: amount, credit: 0, label },
          { accountCode: entry.fixedAsset.depreciationAccount.code, debit: 0, credit: amount, label },
        ];

        const journalEntry = await this.journalEntries.postBalancedEntry(companyId, userId, {
          journalId: journal.id,
          date: entry.periodEndDate,
          description: label,
          sourceType: "DepreciationEntry",
          sourceId: entry.id,
          lines,
        });

        await this.prisma.depreciationEntry.update({
          where: { id: entry.id },
          data: { isPosted: true, journalEntryId: journalEntry.id, fiscalYearId: journalEntry.fiscalYearId, postedAt: new Date() },
        });

        if (entry.sequenceNumber === entry.fixedAsset.usefulLifeYears) {
          await this.prisma.fixedAsset.update({ where: { id: entry.fixedAsset.id }, data: { status: "FULLY_DEPRECIATED" } });
        }

        posted++;
      } catch (err) {
        skipped++;
        this.logger.warn(`Failed to post depreciation entry ${entry.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return { posted, skipped };
  }
}
