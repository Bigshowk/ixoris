import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { TreasuryPostingService } from "../treasury/treasury-posting.service";
import { toNumber } from "./pos.mappers";

@Injectable()
export class RegistersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treasuryPosting: TreasuryPostingService,
  ) {}

  list(companyId: string) {
    return this.prisma.register.findMany({ where: { store: { companyId } }, orderBy: { name: "asc" } });
  }

  async openSession(registerId: string, userId: string, openingBalance: number) {
    const register = await this.prisma.register.findUnique({ where: { id: registerId } });
    if (!register) throw new NotFoundException(`Register ${registerId} not found`);

    const alreadyOpen = await this.prisma.cashSession.findFirst({ where: { registerId, status: "OPEN" } });
    if (alreadyOpen) throw new BadRequestException(`Register ${registerId} already has an open cash session`);

    return this.prisma.cashSession.create({
      data: { registerId, userId, openingBalance, status: "OPEN" },
    });
  }

  async closeSession(sessionId: string, userId: string, closingBalance: number, varianceNotes?: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: { register: { include: { glAccount: true, store: true } } },
    });
    if (!session) throw new NotFoundException(`Cash session ${sessionId} not found`);
    if (session.status === "CLOSED") throw new BadRequestException(`Cash session ${sessionId} is already closed`);

    const cashSales = await this.prisma.payment.findMany({
      where: { method: "CASH", sale: { cashSessionId: sessionId } },
    });
    const cashTakings = cashSales.reduce((sum, p) => sum + toNumber(p.amount), 0);
    const expectedBalance = toNumber(session.openingBalance) + cashTakings;

    const closed = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: { closingBalance, expectedBalance, status: "CLOSED", closedAt: new Date(), varianceNotes },
    });

    const companyId = session.register.store.companyId;
    const registerAccountCode = session.register.glAccount?.code ?? WELL_KNOWN_ACCOUNTS.caisse;
    await this.treasuryPosting.postSessionVariance(companyId, userId, closed, registerAccountCode);

    return closed;
  }
}
