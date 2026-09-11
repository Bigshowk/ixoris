import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateInteractionDto } from "./dto/create-interaction.dto";

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, userId: string, dto: CreateInteractionDto) {
    if (!dto.customerId && !dto.opportunityId) {
      throw new BadRequestException("customerId or opportunityId is required");
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId } });
      if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }
    if (dto.opportunityId) {
      const opportunity = await this.prisma.opportunity.findFirst({ where: { id: dto.opportunityId, companyId } });
      if (!opportunity) throw new NotFoundException(`Opportunity ${dto.opportunityId} not found`);
    }

    return this.prisma.interaction.create({
      data: {
        customerId: dto.customerId,
        opportunityId: dto.opportunityId,
        userId,
        type: dto.type,
        notes: dto.notes,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  listByCustomer(companyId: string, customerId: string) {
    return this.prisma.interaction.findMany({ where: { customerId, customer: { companyId } }, orderBy: { date: "desc" } });
  }

  listByOpportunity(companyId: string, opportunityId: string) {
    return this.prisma.interaction.findMany({ where: { opportunityId, opportunity: { companyId } }, orderBy: { date: "desc" } });
  }
}
