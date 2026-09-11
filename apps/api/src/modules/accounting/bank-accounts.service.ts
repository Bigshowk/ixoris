import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateBankAccountDto) {
    const glAccount = await this.prisma.account.findFirst({ where: { companyId, code: dto.glAccountCode } });
    if (!glAccount) throw new BadRequestException(`No account with code "${dto.glAccountCode}" in this company's chart of accounts`);

    return this.prisma.bankAccount.create({
      data: {
        companyId,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        iban: dto.iban,
        currencyCode: dto.currencyCode ?? "XOF",
        glAccountId: glAccount.id,
      },
    });
  }

  list(companyId: string) {
    return this.prisma.bankAccount.findMany({ where: { companyId }, include: { glAccount: true } });
  }

  async findOne(companyId: string, id: string) {
    const bankAccount = await this.prisma.bankAccount.findFirst({ where: { id, companyId }, include: { glAccount: true } });
    if (!bankAccount) throw new NotFoundException(`Bank account ${id} not found`);
    return bankAccount;
  }
}
