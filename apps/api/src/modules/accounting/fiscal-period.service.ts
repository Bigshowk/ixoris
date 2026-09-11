import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FiscalPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds the open FiscalYear/AccountingPeriod a date falls into — required before posting any entry. */
  async resolve(companyId: string, date: Date): Promise<{ fiscalYearId: string; periodId: string }> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
        fiscalYear: { companyId },
      },
      select: { id: true, fiscalYearId: true, isClosed: true },
    });

    if (!period) {
      throw new NotFoundException(`No accounting period found for ${date.toISOString().slice(0, 10)}`);
    }
    return { fiscalYearId: period.fiscalYearId, periodId: period.id };
  }
}
