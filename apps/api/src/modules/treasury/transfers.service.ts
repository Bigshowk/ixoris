import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Account } from "@ixoris/database";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { TreasuryPostingService } from "./treasury-posting.service";
import { CreateCashTransferDto, TreasuryAccountHolderType } from "./dto/cash-transfer.dto";

@Injectable()
export class CashTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: TreasuryPostingService,
  ) {}

  async create(companyId: string, userId: string, dto: CreateCashTransferDto) {
    const fromAccount = await this.resolveHolderAccount(companyId, dto.fromType, dto.fromId);
    const toAccount = await this.resolveHolderAccount(companyId, dto.toType, dto.toId);

    return this.prisma.cashTransfer.create({
      data: {
        companyId,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: dto.amount,
        reference: dto.reference,
        status: "PENDING",
        createdById: userId,
      },
    });
  }

  list(companyId: string) {
    return this.prisma.cashTransfer.findMany({
      where: { companyId },
      include: { fromAccount: true, toAccount: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async complete(companyId: string, userId: string, id: string) {
    const transfer = await this.prisma.cashTransfer.findFirst({ where: { id, companyId }, include: { fromAccount: true, toAccount: true } });
    if (!transfer) throw new NotFoundException(`Cash transfer ${id} not found`);
    if (transfer.status !== "PENDING") throw new BadRequestException(`Cash transfer ${id} is not pending`);

    await this.posting.postCashTransfer(companyId, userId, transfer, transfer.fromAccount.code, transfer.toAccount.code);
    return this.prisma.cashTransfer.findUniqueOrThrow({ where: { id } });
  }

  async cancel(companyId: string, id: string) {
    const transfer = await this.prisma.cashTransfer.findFirst({ where: { id, companyId } });
    if (!transfer) throw new NotFoundException(`Cash transfer ${id} not found`);
    if (transfer.status !== "PENDING") throw new BadRequestException(`Cash transfer ${id} is not pending`);
    return this.prisma.cashTransfer.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  private async resolveHolderAccount(companyId: string, type: TreasuryAccountHolderType, id: string): Promise<Account> {
    if (type === "REGISTER") {
      const register = await this.prisma.register.findFirst({ where: { id, store: { companyId } }, include: { glAccount: true } });
      if (!register) throw new NotFoundException(`Register ${id} not found`);
      if (register.glAccount) return register.glAccount;
      return this.resolveByCode(companyId, WELL_KNOWN_ACCOUNTS.caisse);
    }
    if (type === "CASHBOX") {
      const cashBox = await this.prisma.cashBox.findFirst({ where: { id, companyId }, include: { glAccount: true } });
      if (!cashBox) throw new NotFoundException(`Cash box ${id} not found`);
      return cashBox.glAccount;
    }
    if (type === "BANK_ACCOUNT") {
      const bankAccount = await this.prisma.bankAccount.findFirst({ where: { id, companyId }, include: { glAccount: true } });
      if (!bankAccount) throw new NotFoundException(`Bank account ${id} not found`);
      return bankAccount.glAccount;
    }
    throw new BadRequestException(`Unsupported treasury holder type ${type}`);
  }

  private async resolveByCode(companyId: string, code: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({ where: { companyId, code } });
    if (!account) throw new NotFoundException(`Account ${code} not found`);
    return account;
  }
}
