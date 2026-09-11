import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { FiscalPeriodService } from "./fiscal-period.service";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

const entryInclude = { lines: { include: { account: true } }, journal: true } as const;

export interface AutoPostLine {
  accountCode: string;
  debit: number;
  credit: number;
  label?: string;
}

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
  ) {}

  async create(companyId: string, createdById: string, dto: CreateJournalEntryDto) {
    const journal = await this.prisma.journal.findFirst({ where: { companyId, code: dto.journalCode } });
    if (!journal) throw new NotFoundException(`Journal ${dto.journalCode} not found`);

    return this.postBalancedEntry(companyId, createdById, {
      journalId: journal.id,
      date: new Date(dto.date),
      description: dto.description,
      sourceType: "Manual",
      lines: dto.lines,
    });
  }

  /**
   * Used by other modules (POS checkout, invoice validation...) to post an
   * already-computed set of balanced lines without going through the manual
   * entry DTO/journal-code lookup twice.
   */
  async postBalancedEntry(
    companyId: string,
    createdById: string | undefined,
    input: {
      journalId: string;
      date: Date;
      description?: string;
      sourceType: string;
      sourceId?: string;
      lines: AutoPostLine[];
    },
  ) {
    const totalDebit = round2(input.lines.reduce((sum, l) => sum + l.debit, 0));
    const totalCredit = round2(input.lines.reduce((sum, l) => sum + l.credit, 0));
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(`Journal entry is not balanced: debit ${totalDebit} != credit ${totalCredit}`);
    }
    if (input.lines.some((l) => l.debit > 0 && l.credit > 0)) {
      throw new BadRequestException("A journal line cannot carry both a debit and a credit amount");
    }

    const { fiscalYearId, periodId } = await this.fiscalPeriod.resolve(companyId, input.date);

    const accounts = await this.prisma.account.findMany({
      where: { companyId, code: { in: input.lines.map((l) => l.accountCode) } },
    });
    const accountByCode = new Map(accounts.map((a) => [a.code, a]));
    const missing = [...new Set(input.lines.map((l) => l.accountCode))].filter((code) => !accountByCode.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown account code(s): ${missing.join(", ")}`);
    }

    return this.prisma.journalEntry.create({
      data: {
        companyId,
        journalId: input.journalId,
        fiscalYearId,
        periodId,
        reference: generateReference(),
        date: input.date,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        isPosted: true,
        createdById,
        lines: {
          create: input.lines.map((l) => ({
            accountId: accountByCode.get(l.accountCode)!.id,
            debit: l.debit,
            credit: l.credit,
            label: l.label,
          })),
        },
      },
      include: entryInclude,
    });
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({ where: { id, companyId }, include: entryInclude });
    if (!entry) throw new NotFoundException(`Journal entry ${id} not found`);
    return entry;
  }

  async list(companyId: string, journalCode?: string, periodId?: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        companyId,
        periodId,
        journal: journalCode ? { code: journalCode } : undefined,
      },
      include: entryInclude,
      orderBy: { date: "desc" },
      take: 200,
    });
  }
}

function generateReference(): string {
  return `JE-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
