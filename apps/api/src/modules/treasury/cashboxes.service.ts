import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ApprovalsService } from "../documents/approvals.service";
import { TreasuryPostingService } from "./treasury-posting.service";
import { CreateCashBoxDto, CreateCashMovementDto } from "./dto/cashbox.dto";

@Injectable()
export class CashBoxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: TreasuryPostingService,
    private readonly approvals: ApprovalsService,
  ) {}

  async create(companyId: string, dto: CreateCashBoxDto) {
    const account = await this.resolveAccount(companyId, dto.glAccountCode);
    return this.prisma.cashBox.create({
      data: { companyId, name: dto.name, type: dto.type, glAccountId: account.id, storeId: dto.storeId },
      include: { glAccount: true },
    });
  }

  list(companyId: string) {
    return this.prisma.cashBox.findMany({ where: { companyId }, include: { glAccount: true }, orderBy: { name: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const cashBox = await this.prisma.cashBox.findFirst({ where: { id, companyId }, include: { glAccount: true } });
    if (!cashBox) throw new NotFoundException(`Cash box ${id} not found`);
    return cashBox;
  }

  async listMovements(companyId: string, cashBoxId: string) {
    await this.findOne(companyId, cashBoxId);
    return this.prisma.cashMovement.findMany({ where: { companyId, cashBoxId }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  async addMovement(companyId: string, userId: string, cashBoxId: string, dto: CreateCashMovementDto) {
    const cashBox = await this.findOne(companyId, cashBoxId);
    const counterAccount = await this.resolveAccount(companyId, dto.counterAccountCode);

    const movement = await this.prisma.cashMovement.create({
      data: {
        companyId,
        cashBoxId,
        type: dto.type,
        amount: dto.amount,
        counterAccountId: counterAccount.id,
        reference: dto.reference,
        notes: dto.notes,
        createdById: userId,
      },
    });

    if (dto.type === "EXPENSE") {
      const approvalRequest = await this.approvals.requestIfNeeded(companyId, "EXPENSE", movement.id, dto.amount, userId);
      if (approvalRequest) return { ...movement, approvalRequest };
    }

    await this.posting.postCashMovement(companyId, userId, movement, cashBox.glAccount.code, counterAccount.code);
    return this.prisma.cashMovement.findUniqueOrThrow({ where: { id: movement.id } });
  }

  /** Posts an EXPENSE movement that was held for approval, once its ApprovalRequest is APPROVED. */
  async postApprovedMovement(companyId: string, userId: string, movementId: string) {
    const movement = await this.prisma.cashMovement.findFirst({
      where: { id: movementId, companyId },
      include: { cashBox: { include: { glAccount: true } }, counterAccount: true },
    });
    if (!movement) throw new NotFoundException(`Cash movement ${movementId} not found`);
    if (movement.journalEntryId) throw new BadRequestException(`Cash movement ${movementId} is already posted`);

    const approvalRequest = await this.prisma.approvalRequest.findFirst({ where: { companyId, type: "EXPENSE", targetId: movementId } });
    if (approvalRequest && approvalRequest.status !== "APPROVED") {
      throw new BadRequestException(`Cash movement ${movementId} has not been approved yet`);
    }

    await this.posting.postCashMovement(companyId, userId, movement, movement.cashBox.glAccount.code, movement.counterAccount.code);
    return this.prisma.cashMovement.findUniqueOrThrow({ where: { id: movementId } });
  }

  private async resolveAccount(companyId: string, code: string) {
    const account = await this.prisma.account.findFirst({ where: { companyId, code } });
    if (!account) throw new NotFoundException(`Account ${code} not found`);
    return account;
  }
}
