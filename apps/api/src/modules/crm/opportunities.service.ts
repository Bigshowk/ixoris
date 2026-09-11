import { Injectable, NotFoundException } from "@nestjs/common";
import { PipelineStage } from "@ixoris/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateOpportunityDto, UpdateOpportunityStageDto } from "./dto/opportunity.dto";

const STAGES: PipelineStage[] = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateOpportunityDto) {
    return this.prisma.opportunity.create({
      data: {
        companyId,
        title: dto.title,
        customerId: dto.customerId,
        amount: dto.amount ?? 0,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
        assignedToId: dto.assignedToId,
        stage: "NEW",
      },
    });
  }

  list(companyId: string) {
    return this.prisma.opportunity.findMany({ where: { companyId }, include: { customer: true, assignedTo: true }, orderBy: { createdAt: "desc" } });
  }

  /** Groups opportunities by stage — feeds a Kanban board directly, one column per stage. */
  async kanban(companyId: string) {
    const opportunities = await this.list(companyId);
    const board = Object.fromEntries(STAGES.map((stage) => [stage, [] as typeof opportunities])) as Record<PipelineStage, typeof opportunities>;
    for (const opportunity of opportunities) {
      board[opportunity.stage].push(opportunity);
    }
    return board;
  }

  async findOne(companyId: string, id: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, companyId },
      include: { customer: true, assignedTo: true, interactions: { orderBy: { date: "desc" } } },
    });
    if (!opportunity) throw new NotFoundException(`Opportunity ${id} not found`);
    return opportunity;
  }

  async updateStage(companyId: string, id: string, dto: UpdateOpportunityStageDto) {
    await this.findOne(companyId, id);
    return this.prisma.opportunity.update({ where: { id }, data: { stage: dto.stage } });
  }
}
