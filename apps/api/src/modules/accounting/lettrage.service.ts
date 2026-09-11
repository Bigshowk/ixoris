import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { autoMatchLettrage } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { mapJournalLine } from "./accounting.mappers";

@Injectable()
export class LettrageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Auto-matches unlettered debit/credit lines of equal amount on one account (see accounting-engine for the exact-match rule). */
  async autoMatch(companyId: string, accountCode: string) {
    const account = await this.prisma.account.findFirst({ where: { companyId, code: accountCode } });
    if (!account) throw new NotFoundException(`Account ${accountCode} not found`);

    const lines = await this.prisma.journalLine.findMany({
      where: { accountId: account.id, journalEntry: { companyId, isPosted: true } },
      include: { account: true, journalEntry: { select: { id: true, date: true } } },
    });

    const matches = autoMatchLettrage(lines.map(mapJournalLine), () => randomBytes(4).toString("hex").toUpperCase());

    for (const match of matches) {
      await this.prisma.journalLine.updateMany({
        where: { id: { in: match.lineIds } },
        data: { lettrageCode: match.lettrageCode },
      });
    }

    return { accountCode, matchedPairs: matches.length, matches };
  }
}
