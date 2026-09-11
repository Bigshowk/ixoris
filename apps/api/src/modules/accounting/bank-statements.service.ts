import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { matchBankStatement, parseBankStatementCsv } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { ImportBankStatementDto } from "./dto/import-bank-statement.dto";
import { ManualMatchDto } from "./dto/manual-match.dto";
import { toNumber } from "../pos/pos.mappers";

const statementInclude = { lines: { orderBy: { date: "asc" as const } }, bankAccount: true };

@Injectable()
export class BankStatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async import(companyId: string, dto: ImportBankStatementDto) {
    const bankAccount = await this.prisma.bankAccount.findFirst({ where: { id: dto.bankAccountId, companyId } });
    if (!bankAccount) throw new NotFoundException(`Bank account ${dto.bankAccountId} not found`);

    let parsedLines;
    try {
      parsedLines = parseBankStatementCsv(dto.csv);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "Invalid statement CSV");
    }
    if (parsedLines.length === 0) throw new BadRequestException("Statement CSV has no data rows");

    return this.prisma.bankStatement.create({
      data: {
        bankAccountId: bankAccount.id,
        statementDate: new Date(dto.statementDate),
        startBalance: dto.startBalance,
        endBalance: dto.endBalance,
        lines: { create: parsedLines.map((l) => ({ date: l.date, label: l.label, amount: l.amount })) },
      },
      include: statementInclude,
    });
  }

  async findOne(companyId: string, id: string) {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id, bankAccount: { companyId } },
      include: statementInclude,
    });
    if (!statement) throw new NotFoundException(`Bank statement ${id} not found`);
    return statement;
  }

  async list(companyId: string, bankAccountId?: string) {
    return this.prisma.bankStatement.findMany({
      where: { bankAccount: { companyId }, bankAccountId },
      include: statementInclude,
      orderBy: { statementDate: "desc" },
    });
  }

  /** Auto-reconciles unmatched statement lines against unmatched journal lines on the bank's GL account. */
  async autoMatch(companyId: string, statementId: string) {
    const statement = await this.findOne(companyId, statementId);
    const unreconciled = statement.lines.filter((l) => !l.isReconciled);
    if (unreconciled.length === 0) return { matched: 0 };

    const alreadyMatchedJournalLineIds = await this.prisma.bankStatementLine.findMany({
      where: { statement: { bankAccountId: statement.bankAccountId }, matchedJournalLineId: { not: null } },
      select: { matchedJournalLineId: true },
    });
    const excludeIds = alreadyMatchedJournalLineIds.map((l) => l.matchedJournalLineId!).filter(Boolean);

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: statement.bankAccount.glAccountId,
        id: { notIn: excludeIds },
        journalEntry: { companyId, isPosted: true },
      },
      include: { journalEntry: { select: { date: true } } },
    });

    const matches = matchBankStatement(
      unreconciled.map((l) => ({ id: l.id, date: l.date, amount: toNumber(l.amount), label: l.label })),
      journalLines.map((jl) => ({ id: jl.id, date: jl.journalEntry.date, debit: toNumber(jl.debit), credit: toNumber(jl.credit) })),
    );

    for (const match of matches) {
      await this.prisma.bankStatementLine.update({
        where: { id: match.statementLineId },
        data: { isReconciled: true, matchedJournalLineId: match.journalLineId },
      });
    }

    return { matched: matches.length, remaining: unreconciled.length - matches.length };
  }

  async manualMatch(companyId: string, statementId: string, lineId: string, dto: ManualMatchDto) {
    const statement = await this.findOne(companyId, statementId);
    const line = statement.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(`Statement line ${lineId} not found`);

    const journalLine = await this.prisma.journalLine.findFirst({
      where: { id: dto.journalLineId, accountId: statement.bankAccount.glAccountId, journalEntry: { companyId } },
    });
    if (!journalLine) throw new BadRequestException(`Journal line ${dto.journalLineId} not found on this bank's account`);

    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { isReconciled: true, matchedJournalLineId: journalLine.id },
    });
  }

  async summary(companyId: string, statementId: string) {
    const statement = await this.findOne(companyId, statementId);
    const reconciled = statement.lines.filter((l) => l.isReconciled);
    const unreconciled = statement.lines.filter((l) => !l.isReconciled);

    return {
      totalLines: statement.lines.length,
      reconciledLines: reconciled.length,
      unreconciledLines: unreconciled.length,
      unreconciledAmount: round2(unreconciled.reduce((sum, l) => sum + toNumber(l.amount), 0)),
      statementNetMovement: round2(toNumber(statement.endBalance) - toNumber(statement.startBalance)),
    };
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
