import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalableType, ApprovalRequest } from "@ixoris/database";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { CreateApprovalRuleDto, DecideApprovalRequestDto } from "./dto/approval.dto";

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  createRule(companyId: string, dto: CreateApprovalRuleDto) {
    return this.prisma.approvalRule.create({
      data: { companyId, appliesTo: dto.appliesTo, minAmount: dto.minAmount, requiredRoleId: dto.requiredRoleId },
      include: { requiredRole: true },
    });
  }

  listRules(companyId: string) {
    return this.prisma.approvalRule.findMany({ where: { companyId }, include: { requiredRole: true }, orderBy: { minAmount: "asc" } });
  }

  async deleteRule(companyId: string, id: string): Promise<void> {
    const rule = await this.prisma.approvalRule.findFirst({ where: { id, companyId } });
    if (!rule) throw new NotFoundException(`Approval rule ${id} not found`);
    await this.prisma.approvalRule.delete({ where: { id } });
  }

  /**
   * Called by the owning module (purchase orders, expense cash movements)
   * before finalizing an operation above a configurable threshold. Returns
   * the created PENDING request if a rule applies, or null when the amount
   * clears every threshold and the caller may proceed unattended.
   */
  async requestIfNeeded(companyId: string, type: ApprovalableType, targetId: string, amount: number, requestedById: string): Promise<ApprovalRequest | null> {
    const applicableRule = await this.prisma.approvalRule.findFirst({
      where: { companyId, appliesTo: type, minAmount: { lte: amount } },
      orderBy: { minAmount: "desc" },
    });
    if (!applicableRule) return null;

    return this.prisma.approvalRequest.create({
      data: { companyId, type, targetId, amount, requestedById, status: "PENDING" },
    });
  }

  listRequests(companyId: string, status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.prisma.approvalRequest.findMany({
      where: { companyId, status },
      include: { requestedBy: true, decidedBy: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async decide(companyId: string, requestId: string, deciderId: string, dto: DecideApprovalRequestDto) {
    const request = await this.prisma.approvalRequest.findFirst({ where: { id: requestId, companyId } });
    if (!request) throw new NotFoundException(`Approval request ${requestId} not found`);
    if (request.status !== "PENDING") throw new BadRequestException(`Approval request ${requestId} was already decided`);

    const rule = await this.prisma.approvalRule.findFirst({
      where: { companyId, appliesTo: request.type, minAmount: { lte: toNumber(request.amount) } },
      orderBy: { minAmount: "desc" },
    });
    if (rule) {
      const hasRole = await this.prisma.userRole.findFirst({ where: { userId: deciderId, roleId: rule.requiredRoleId } });
      if (!hasRole) throw new ForbiddenException("You do not hold the role required to decide this approval request");
    }

    return this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: dto.decision, decidedById: deciderId, decidedAt: new Date(), comment: dto.comment },
    });
  }
}
