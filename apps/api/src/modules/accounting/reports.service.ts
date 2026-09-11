import { Injectable } from "@nestjs/common";
import {
  computeBalanceSheet,
  computeGeneralLedger,
  computeIncomeStatement,
  computeJournalSummary,
  computeTrialBalance,
  JournalTotalsInput,
} from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { mapAccount, mapJournalLine } from "./accounting.mappers";
import { toNumber } from "../pos/pos.mappers";

export interface ReportScope {
  fiscalYearId?: string;
  periodId?: string;
  asOfDate?: Date;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadAccountsAndLines(companyId: string, scope: ReportScope) {
    const [accounts, lines] = await Promise.all([
      this.prisma.account.findMany({ where: { companyId } }),
      this.prisma.journalLine.findMany({
        where: {
          journalEntry: {
            companyId,
            isPosted: true,
            periodId: scope.periodId,
            fiscalYearId: scope.fiscalYearId,
            date: scope.asOfDate ? { lte: scope.asOfDate } : undefined,
          },
        },
        include: { account: true, journalEntry: { select: { id: true, date: true } } },
      }),
    ]);

    return { ledgerAccounts: accounts.map(mapAccount), ledgerLines: lines.map(mapJournalLine) };
  }

  fiscalYears(companyId: string) {
    return this.prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" } });
  }

  async trialBalance(companyId: string, scope: ReportScope) {
    const { ledgerAccounts, ledgerLines } = await this.loadAccountsAndLines(companyId, scope);
    return computeTrialBalance(ledgerAccounts, ledgerLines);
  }

  async generalLedger(companyId: string, scope: ReportScope, accountCode?: string) {
    const { ledgerAccounts, ledgerLines } = await this.loadAccountsAndLines(companyId, scope);
    const accounts = accountCode ? ledgerAccounts.filter((a) => a.code === accountCode) : ledgerAccounts;
    const lines = accountCode ? ledgerLines.filter((l) => l.accountCode === accountCode) : ledgerLines;
    return computeGeneralLedger(accounts, lines);
  }

  async journalSummary(companyId: string, periodId?: string) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, isPosted: true, periodId },
      include: { journal: true, lines: true },
    });

    const totals = new Map<string, JournalTotalsInput>();
    for (const entry of entries) {
      const bucket = totals.get(entry.journal.code) ?? {
        journalCode: entry.journal.code,
        journalLabel: entry.journal.label,
        debit: 0,
        credit: 0,
      };
      for (const line of entry.lines) {
        bucket.debit += toNumber(line.debit);
        bucket.credit += toNumber(line.credit);
      }
      totals.set(entry.journal.code, bucket);
    }

    return computeJournalSummary([...totals.values()]);
  }

  async incomeStatement(companyId: string, fiscalYearId: string) {
    const trialBalance = await this.trialBalance(companyId, { fiscalYearId });
    return computeIncomeStatement(trialBalance);
  }

  async balanceSheet(companyId: string, fiscalYearId: string, asOfDate?: Date) {
    const [trialBalance, accounts] = await Promise.all([
      this.trialBalance(companyId, { fiscalYearId, asOfDate }),
      this.prisma.account.findMany({ where: { companyId } }),
    ]);
    const incomeStatement = computeIncomeStatement(trialBalance);
    return computeBalanceSheet(accounts.map(mapAccount), trialBalance, incomeStatement.resultatNet);
  }
}
